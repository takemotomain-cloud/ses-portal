/**
 * URLを自動リンク化するテキストコンポーネント
 *
 * テキスト中のURLを検出して <a> タグに変換する。
 * 改行も <br> に変換する。
 */

'use client';

import React from 'react';

/** URL正規表現パターン */
const URL_REGEX = /(https?:\/\/[^\s<>「」『』（）\[\]]+)/g;

interface LinkedTextProps {
  text: string;
  className?: string;
}

export function LinkedText({ text, className }: LinkedTextProps) {
  const lines = text.split('\n');

  return (
    <span className={className}>
      {lines.map((line, lineIdx) => (
        <React.Fragment key={lineIdx}>
          {lineIdx > 0 && <br />}
          {renderLine(line)}
        </React.Fragment>
      ))}
    </span>
  );
}

function renderLine(line: string) {
  const parts = line.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      // URLの末尾の句読点を除去
      let url = part;
      const trailingPunct = /[。、.,;:）)]+$/.exec(url);
      let suffix = '';
      if (trailingPunct) {
        suffix = trailingPunct[0];
        url = url.slice(0, -suffix.length);
      }
      return (
        <React.Fragment key={i}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 break-all"
          >
            {url}
          </a>
          {suffix}
        </React.Fragment>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
