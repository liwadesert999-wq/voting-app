import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { candidates } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const sessionId = formData.get("sessionId") as string;

  if (!file || !sessionId) {
    return NextResponse.json(
      { error: "파일과 세션 ID가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "엑셀 파일에 데이터가 없습니다." },
        { status: 400 }
      );
    }

    // Delete existing candidates for this session
    await db.delete(candidates).where(eq(candidates.sessionId, sessionId));

    // Parse rows - support flexible column names
    const parsed = rows.map((row, index) => {
      const values = Object.values(row);
      const keys = Object.keys(row).map((k) => k.toLowerCase().trim());

      let number: number;
      let name: string;
      let description: string | null = null;

      const numberIdx = keys.findIndex((k) =>
        ["번호", "no", "no.", "number", "#"].includes(k)
      );
      const nameIdx = keys.findIndex((k) =>
        ["이름", "name", "성명", "후보", "후보자"].includes(k)
      );
      const descIdx = keys.findIndex((k) =>
        ["설명", "description", "소속", "부서", "비고", "info"].includes(k)
      );

      if (numberIdx >= 0 && nameIdx >= 0) {
        number = Number(values[numberIdx]) || index + 1;
        name = String(values[nameIdx]);
        description = descIdx >= 0 ? String(values[descIdx]) : null;
      } else {
        number = Number(values[0]) || index + 1;
        name = String(values[1] || values[0]);
        description = values[2] ? String(values[2]) : null;
      }

      return {
        sessionId,
        number,
        name,
        description,
        sortOrder: index,
      };
    });

    // Insert all candidates
    for (const candidate of parsed) {
      await db.insert(candidates).values(candidate);
    }

    return NextResponse.json({
      success: true,
      count: parsed.length,
      candidates: parsed,
    });
  } catch (error) {
    console.error("Excel parse error:", error);
    return NextResponse.json(
      { error: "엑셀 파일을 파싱하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
