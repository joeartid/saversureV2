"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { isLoggedIn, setPostLoginRedirect } from "@/lib/auth";

interface SurveyQuestion {
  type?: string;
  label?: string;
  options?: string[];
}

interface Survey {
  id: string;
  title: string;
  questions: SurveyQuestion[];
  trigger_event?: string | null;
  active: boolean;
  created_at: string;
}

type AnswersMap = Record<string, string>;

export default function SurveysPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingSurveyId, setSavingSurveyId] = useState<string>("");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswersMap>>({});

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Survey[] }>("/api/v1/my/surveys");
      const items = res.data || [];
      setSurveys(items);
      setAnswers((prev) => {
        const next = { ...prev };
        for (const survey of items) {
          if (!next[survey.id]) next[survey.id] = {};
        }
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "โหลดแบบสอบถามไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      setPostLoginRedirect("/surveys");
      router.replace("/login");
      return;
    }
    void loadSurveys();
  }, [router]);

  const totalQuestions = useMemo(
    () => surveys.reduce((sum, item) => sum + (item.questions?.length || 0), 0),
    [surveys],
  );

  const updateAnswer = (surveyId: string, questionIndex: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [surveyId]: {
        ...(prev[surveyId] || {}),
        [String(questionIndex)]: value,
      },
    }));
  };

  const handleSubmitSurvey = async (survey: Survey) => {
    const surveyAnswers = answers[survey.id] || {};
    const answerPayload = survey.questions.map((question, index) => ({
      type: question.type || "text",
      label: question.label || `Question ${index + 1}`,
      value: surveyAnswers[String(index)] || "",
    }));
    if (answerPayload.some((item) => !String(item.value || "").trim())) {
      toast.error("กรุณาตอบคำถามให้ครบก่อนส่ง");
      return;
    }
    const ratingQuestion = survey.questions.findIndex((q) => q.type === "rating");
    const ratingValue =
      ratingQuestion >= 0 && surveyAnswers[String(ratingQuestion)]
        ? Number(surveyAnswers[String(ratingQuestion)])
        : undefined;

    setSavingSurveyId(survey.id);
    try {
      await api.post(`/api/v1/my/surveys/${survey.id}/respond`, {
        answers: answerPayload,
        rating: Number.isFinite(ratingValue) ? ratingValue : undefined,
      });
      toast.success("ส่งแบบสอบถามแล้ว ขอบคุณสำหรับความคิดเห็น");
      await loadSurveys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ส่งแบบสอบถามไม่สำเร็จ");
    } finally {
      setSavingSurveyId("");
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <Navbar />
      <div className="pt-24">
        <PageHeader title="แบบสอบถาม" subtitle="ช่วยแชร์ความเห็นเพื่อให้เราพัฒนาบริการได้ดีขึ้น" backHref="/profile">
          <div className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
            {surveys.length.toLocaleString()} แบบสอบถาม • {totalQuestions.toLocaleString()} คำถาม
          </div>
        </PageHeader>

        <div className="px-4 mt-6 space-y-4">
          {loading ? (
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">กำลังโหลดแบบสอบถาม...</p>
            </div>
          ) : surveys.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
              <p className="text-lg font-black text-foreground">ยังไม่มีแบบสอบถามที่รอให้ตอบ</p>
              <p className="mt-2 text-sm text-muted-foreground">ขอบคุณครับ ตอนนี้คุณตอบครบแล้ว</p>
            </div>
          ) : (
            surveys.map((survey) => (
              <div key={survey.id} className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-foreground">{survey.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {survey.trigger_event || "manual"} • {survey.questions.length.toLocaleString()} คำถาม
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {survey.questions.map((question, index) => {
                    const value = answers[survey.id]?.[String(index)] || "";
                    if (question.type === "rating") {
                      return (
                        <div key={`${survey.id}-${index}`} className="rounded-2xl bg-secondary p-4">
                          <p className="text-sm font-bold text-foreground">{question.label || `คำถาม ${index + 1}`}</p>
                          <div className="mt-3 grid grid-cols-6 gap-2">
                            {Array.from({ length: 11 }).map((_, rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => updateAnswer(survey.id, index, String(rating))}
                                className={`rounded-xl px-0 py-2 text-sm font-bold ${
                                  value === String(rating)
                                    ? "bg-[var(--jh-green)] text-white"
                                    : "bg-white text-foreground"
                                }`}
                              >
                                {rating}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (question.type === "choice" && question.options?.length) {
                      return (
                        <div key={`${survey.id}-${index}`} className="rounded-2xl bg-secondary p-4">
                          <p className="text-sm font-bold text-foreground">{question.label || `คำถาม ${index + 1}`}</p>
                          <div className="mt-3 space-y-2">
                            {question.options.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => updateAnswer(survey.id, index, option)}
                                className={`block w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
                                  value === option
                                    ? "bg-[var(--jh-green)] text-white"
                                    : "bg-white text-foreground"
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={`${survey.id}-${index}`} className="rounded-2xl bg-secondary p-4">
                        <p className="text-sm font-bold text-foreground">{question.label || `คำถาม ${index + 1}`}</p>
                        <textarea
                          value={value}
                          onChange={(e) => updateAnswer(survey.id, index, e.target.value)}
                          placeholder="พิมพ์คำตอบของคุณ"
                          className="mt-3 min-h-28 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none"
                        />
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => void handleSubmitSurvey(survey)}
                  disabled={savingSurveyId === survey.id}
                  className="mt-4 w-full rounded-2xl bg-[var(--jh-green)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {savingSurveyId === survey.id ? "กำลังส่ง..." : "ส่งแบบสอบถาม"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
