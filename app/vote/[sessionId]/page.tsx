"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { v4 as uuidv4 } from "uuid";

interface Candidate {
  id: number;
  number: number;
  name: string;
  description: string | null;
}

interface SessionInfo {
  id: string;
  name: string;
  maxVotes: number;
  status: string;
}

type PageState = "loading" | "voting" | "confirm" | "done" | "already" | "closed" | "error";

export default function VotePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [state, setState] = useState<PageState>("loading");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/vote/${sessionId}`);
      if (!res.ok) {
        setState("error");
        setErrorMsg("투표를 찾을 수 없습니다.");
        return;
      }

      const data = await res.json();
      setSession(data.session);
      setCandidates(data.candidates);

      if (data.alreadyVoted) {
        setState("already");
      } else if (data.session.status !== "open") {
        setState("closed");
      } else {
        setState("voting");
      }
    } catch {
      setState("error");
      setErrorMsg("서버에 연결할 수 없습니다.");
    }
  }

  function toggleCandidate(candidateId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        if (session && next.size >= session.maxVotes) {
          return prev;
        }
        next.add(candidateId);
      }
      return next;
    });
  }

  function getVoterToken(): string {
    const key = `voter_token_${sessionId}`;
    let token = localStorage.getItem(key);
    if (!token) {
      token = uuidv4();
      localStorage.setItem(key, token);
    }
    return token;
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/vote/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateIds: Array.from(selected),
          voterToken: getVoterToken(),
        }),
      });

      if (res.ok) {
        setState("done");
      } else {
        const data = await res.json();
        if (res.status === 409) {
          setState("already");
        } else {
          setErrorMsg(data.error || "투표에 실패했습니다.");
          setState("error");
        }
      }
    } catch {
      setErrorMsg("서버에 연결할 수 없습니다.");
      setState("error");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading
  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">로딩 중...</p>
      </div>
    );
  }

  // Already voted
  if (state === "already") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold mb-2">이미 투표하셨습니다</h2>
            <p className="text-gray-500">동일한 기기에서 중복 투표는 불가합니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Closed
  if (state === "closed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-bold mb-2">투표가 종료되었습니다</h2>
            <p className="text-gray-500">
              {session?.status === "draft"
                ? "아직 투표가 시작되지 않았습니다."
                : "투표가 마감되었습니다."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error
  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2">오류</h2>
            <p className="text-gray-500">{errorMsg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vote complete
  if (state === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold mb-2">투표 완료!</h2>
            <p className="text-gray-500">소중한 한 표 감사합니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirm screen
  if (state === "confirm") {
    const selectedCandidates = candidates.filter((c) => selected.has(c.id));
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-center mb-2">{session?.name}</h1>
          <p className="text-center text-gray-500 mb-6">선택을 확인해주세요</p>

          <div className="space-y-3 mb-6">
            {selectedCandidates.map((c) => (
              <Card key={c.id}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                      {c.number}
                    </span>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.description && (
                        <p className="text-sm text-gray-500">{c.description}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setState("voting")}
            >
              돌아가기
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "제출 중..." : "투표하기"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Voting screen
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-center mb-1">{session?.name}</h1>
        <p className="text-center text-gray-500 mb-6">
          최대 <span className="font-bold text-blue-600">{session?.maxVotes}명</span>을
          선택하세요
          <span className="ml-2 text-sm">
            ({selected.size}/{session?.maxVotes})
          </span>
        </p>

        <div className="space-y-3 mb-6">
          {candidates.map((c) => {
            const isSelected = selected.has(c.id);
            const isDisabled =
              !isSelected && session ? selected.size >= session.maxVotes : false;
            return (
              <Card
                key={c.id}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? "ring-2 ring-blue-500 bg-blue-50"
                    : isDisabled
                      ? "opacity-50"
                      : "hover:shadow-md"
                }`}
                onClick={() => !isDisabled && toggleCandidate(c.id)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        isSelected
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {isSelected ? "✓" : c.number}
                    </span>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.description && (
                        <p className="text-sm text-gray-500">{c.description}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={selected.size === 0}
          onClick={() => setState("confirm")}
        >
          선택 완료 ({selected.size}명)
        </Button>
      </div>
    </div>
  );
}
