-- 010: 通知テーブルに画像URL列を追加
-- お知らせ配信で画像添付を可能にする

ALTER TABLE notifications
  ADD COLUMN image_url VARCHAR(500);

COMMENT ON COLUMN notifications.image_url IS 'お知らせ添付画像のURL（/uploads/notifications/xxx.jpg）';
