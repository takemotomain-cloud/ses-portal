/**
 * 管理側 面談記録の追加ページ
 *
 * HTMLプロトタイプ page-meeting-add を再現。
 * フォーム: 面談日 / 面談者 / 内容 / 録画URL
 */

'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

export default function MeetingAddPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { toast, ToastUI } = useToast();

  /* ---------- フォーム状態 ---------- */

  const [meetingDate, setMeetingDate] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [content, setContent] = useState('');
  const [recordingUrl, setRecordingUrl] = useState('');

  /* ---------- 送信 ---------- */

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!meetingDate || !interviewer || !content) {
      toast('必須項目を入力してください');
      return;
    }
    setSaving(true);
    try {
      await apiClient(`/employees/${id}/meetings`, {
        method: 'POST',
        body: JSON.stringify({
          date: meetingDate,
          interviewer,
          content,
          videoUrl: recordingUrl || undefined,
        }),
      });
      toast('面談記録を保存しました');
      router.push(`/admin/employees/${id}`);
    } catch {
      toast('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/admin/employees/${id}`);
  };

  return (
    <div>
      {/* ページヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">面談記録の追加</h1>
        <div className="flex gap-2">
          <button onClick={handleCancel} className="btn-outline text-sm py-2">
            キャンセル
          </button>
          <button onClick={handleSave} className="btn-primary text-sm py-2">
            保存
          </button>
        </div>
      </div>

      {/* フォーム */}
      <div className="max-w-[680px]">
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">面談情報</div>

          {/* 面談日 / 面談者 — 2カラムグリッド */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-2xs text-secondary block mb-1">
                面談日 <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-primary/40"
              />
            </div>
            <div>
              <label className="text-2xs text-secondary block mb-1">
                面談者 <span className="text-red-600">*</span>
              </label>
              <select
                value={interviewer}
                onChange={(e) => setInterviewer(e.target.value)}
                className="w-full border border-border/30 rounded-md px-3 py-2 text-sm outline-none appearance-none focus:border-primary/40"
              >
                <option value="">面談者を選択</option>
              </select>
            </div>
          </div>

          {/* 内容 */}
          <div className="mb-2">
            <label className="text-2xs text-secondary block mb-1">
              内容 <span className="text-red-600">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="面談の内容、所感、今後のアクションなどを記入"
              className="w-full border border-border/30 rounded-md px-3 py-2 text-sm outline-none resize-y font-[inherit] h-[120px] focus:border-primary/40"
            />
          </div>

          {/* 録画URL */}
          <div>
            <label className="text-2xs text-secondary block mb-1">録画URL</label>
            <input
              type="url"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              placeholder="https://meet.example.com/rec/..."
              className="w-full border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-primary/40"
            />
          </div>
        </div>
      </div>

      <ToastUI />
    </div>
  );
}
