"use client";

import { useEffect, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Session {
  id: string;
  name: string;
  maxVotes: number;
  status: "draft" | "open" | "closed";
  createdAt: string;
  candidateCount: number;
  voteCount: number;
}

const statusLabel: Record<string, string> = {
  draft: "준비 중",
  open: "진행 중",
  closed: "마감",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  open: "default",
  closed: "destructive",
};

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newMaxVotes, setNewMaxVotes] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  async function fetchSessions() {
    const res = await fetch("/api/admin/sessions");
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    setSessions(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchSessions();
  }, []);

  async function createSession() {
    if (!newName.trim()) return;

    const res = await fetch("/api/admin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, maxVotes: newMaxVotes }),
    });

    if (res.ok) {
      const session = await res.json();
      setNewName("");
      setNewMaxVotes(1);
      setDialogOpen(false);
      router.push(`/admin/session/${session.id}`);
    }
  }

  async function deleteSession(id: string) {
    if (!confirm("이 투표 세션을 삭제하시겠습니까?")) return;

    await fetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
    fetchSessions();
  }

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#004191] text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">투표 관리자</h1>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>+ 새 투표 만들기</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 투표 세션 만들기</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="name">투표 이름</Label>
                  <Input
                    id="name"
                    placeholder="예: 2024 우수사원 투표"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="maxVotes">최대 선택 인원</Label>
                  <Input
                    id="maxVotes"
                    type="number"
                    min={1}
                    value={newMaxVotes}
                    onChange={(e) =>
                      setNewMaxVotes(Math.max(1, parseInt(e.target.value) || 1))
                    }
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    심사위원이 최대 몇 명까지 선택할 수 있는지 설정합니다.
                  </p>
                </div>
                <Button onClick={createSession} className="w-full">
                  만들기
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="text-white border-white/50 hover:bg-white/10 hover:text-white" onClick={handleLogout}>
            로그아웃
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              아직 투표 세션이 없습니다. 새 투표를 만들어보세요.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/admin/session/${session.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{session.name}</CardTitle>
                    <Badge variant={statusVariant[session.status]}>
                      {statusLabel[session.status]}
                    </Badge>
                  </div>
                  <CardDescription>
                    후보자 {session.candidateCount}명 · 투표{" "}
                    {session.voteCount}건 · 최대 {session.maxVotes}명 선택
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">
                      {new Date(session.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                    >
                      삭제
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
