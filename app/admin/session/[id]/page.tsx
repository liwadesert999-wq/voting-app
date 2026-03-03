"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import QRCode from "qrcode";

interface Candidate {
  id: number;
  number: number;
  name: string;
  description: string | null;
  voteCount?: number;
}

interface Session {
  id: string;
  name: string;
  maxVotes: number;
  status: "draft" | "open" | "closed";
}

interface ResultsData {
  session: Session;
  candidates: Candidate[];
  totalVotes: number;
}

const statusLabel: Record<string, string> = {
  draft: "준비 중",
  open: "진행 중",
  closed: "마감",
};

const COLORS = [
  "#004191", "#0062B8", "#0080D0", "#339FDB", "#66B8E5",
  "#0050A0", "#1A6FB5", "#3388C8", "#4DA0D8", "#80C0E8",
];

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionCandidates, setSessionCandidates] = useState<Candidate[]>([]);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [maxVotesEdit, setMaxVotesEdit] = useState(1);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const router = useRouter();

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const voteUrl = `${baseUrl}/vote/${id}`;

  async function fetchSession() {
    const res = await fetch(`/api/admin/sessions/${id}`);
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    if (!res.ok) {
      router.push("/admin");
      return;
    }
    const data = await res.json();
    setSession(data);
    setSessionCandidates(data.candidates || []);
    setMaxVotesEdit(data.maxVotes);
    setLoading(false);
  }

  async function generateQR() {
    try {
      const url = await QRCode.toDataURL(voteUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#004191", light: "#ffffff" },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error("QR generation error:", err);
    }
  }

  function connectSSE() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const es = new EventSource(`/api/admin/results/${id}`, {});
    es.onmessage = (event) => {
      const data = JSON.parse(event.data) as ResultsData;
      setResults(data);
    };
    es.onerror = () => {
      es.close();
      // Reconnect after 3 seconds
      setTimeout(() => connectSSE(), 3000);
    };
    eventSourceRef.current = es;
  }

  useEffect(() => {
    fetchSession();
    generateQR();
    connectSSE();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [id]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", id);

    const res = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      alert("업로드 완료!");
      fetchSession();
    } else {
      const data = await res.json();
      alert(data.error || "업로드 실패");
    }
    e.target.value = "";
  }

  async function updateStatus(status: string) {
    await fetch(`/api/admin/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchSession();
  }

  async function updateMaxVotes() {
    await fetch(`/api/admin/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxVotes: maxVotesEdit }),
    });
    fetchSession();
  }

  function downloadQR() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `vote-qr-${id}.png`;
    a.click();
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  const chartData =
    results?.candidates.map((c) => ({
      name: `${c.number}. ${c.name}`,
      votes: c.voteCount || 0,
    })) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#004191] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" className="text-white border-white/50 hover:bg-white/10 hover:text-white" onClick={() => router.push("/admin")}>
            ← 목록
          </Button>
          <h1 className="text-xl font-bold">{session.name}</h1>
          <Badge
            variant={
              session.status === "open"
                ? "default"
                : session.status === "closed"
                  ? "destructive"
                  : "secondary"
            }
          >
            {statusLabel[session.status]}
          </Badge>
        </div>
        <div className="flex gap-2">
          {session.status === "draft" && (
            <Button
              onClick={() => updateStatus("open")}
              disabled={sessionCandidates.length === 0}
            >
              투표 시작
            </Button>
          )}
          {session.status === "open" && (
            <Button variant="destructive" onClick={() => updateStatus("closed")}>
              투표 마감
            </Button>
          )}
          {session.status === "closed" && (
            <Button variant="outline" onClick={() => updateStatus("open")}>
              투표 재개
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Settings & Upload Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Max Votes Setting */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">최대 선택 인원</CardTitle>
              <CardDescription>
                심사위원이 선택할 수 있는 최대 인원
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={maxVotesEdit}
                  onChange={(e) =>
                    setMaxVotesEdit(Math.max(1, parseInt(e.target.value) || 1))
                  }
                />
                <Button
                  onClick={updateMaxVotes}
                  disabled={maxVotesEdit === session.maxVotes}
                >
                  저장
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Excel Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">후보자 업로드</CardTitle>
              <CardDescription>
                엑셀 파일 (.xlsx, .xls)로 후보자 등록
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Label
                htmlFor="excel-upload"
                className="cursor-pointer inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                파일 선택
              </Label>
              <Input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
              <p className="text-xs text-gray-400 mt-2">
                열 순서: 번호, 이름, 설명(선택)
              </p>
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">QR 코드</CardTitle>
              <CardDescription>심사위원에게 공유할 QR 코드</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="투표 QR 코드"
                  className="w-40 h-40"
                />
              )}
              <p className="text-xs text-gray-400 break-all text-center">
                {voteUrl}
              </p>
              <Button variant="outline" size="sm" onClick={downloadQR}>
                QR 다운로드
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Candidates Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              후보자 목록 ({sessionCandidates.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessionCandidates.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                엑셀 파일을 업로드하여 후보자를 등록하세요.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">번호</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>설명</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionCandidates.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.number}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-gray-500">
                        {c.description || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Real-time Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              투표 결과 (실시간)
              {results && (
                <span className="font-normal text-gray-500 ml-2">
                  총 {results.totalVotes}표
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!results || results.candidates.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                투표 데이터가 없습니다.
              </p>
            ) : (
              <div className="space-y-6">
                <ResponsiveContainer width="100%" height={Math.max(300, results.candidates.length * 50)}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={90} />
                    <Tooltip />
                    <Bar dataKey="votes" name="득표 수" radius={[0, 4, 4, 0]}>
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Results Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">순위</TableHead>
                      <TableHead className="w-16">번호</TableHead>
                      <TableHead>이름</TableHead>
                      <TableHead className="w-24 text-right">득표 수</TableHead>
                      <TableHead className="w-24 text-right">득표율</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...results.candidates]
                      .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
                      .map((c, idx) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-bold">{idx + 1}</TableCell>
                          <TableCell>{c.number}</TableCell>
                          <TableCell>{c.name}</TableCell>
                          <TableCell className="text-right font-medium">
                            {c.voteCount || 0}
                          </TableCell>
                          <TableCell className="text-right text-gray-500">
                            {results.totalVotes > 0
                              ? (
                                  ((c.voteCount || 0) / results.totalVotes) *
                                  100
                                ).toFixed(1)
                              : 0}
                            %
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
