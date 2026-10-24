import { useState } from 'react';
import { IMPORT_MAX_IMAGES } from '@gokkan-keeper/shared';

interface ImportUploadProps {
  busy: string | null;
  onUpload: (files: File[]) => void;
}

/** Picks the screenshots for one import. */
export function ImportUpload({ busy, onUpload }: ImportUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const tooMany = files.length > IMPORT_MAX_IMAGES;
  return (
    <div className="gk-card gk-card-pad gk-stack">
      <div>
        <h2 className="gk-section-heading">스크린샷 고르기</h2>
        <p className="gk-hint mt-1">
          삼성증권 앱의 <b>주식잔고</b>(국내 또는 해외) 화면을 종목이 모두 보이도록 여러 장 찍고, <b>예수금</b>(해외는 외화잔고) 화면도 함께 올려주세요.
          화면이 겹쳐도 괜찮아요. 이미지는 판독이 끝나면 바로 삭제돼요.
        </p>
      </div>
      <label className="gk-field">
        <span className="gk-label">스크린샷 (최대 {IMPORT_MAX_IMAGES}장)</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={!!busy}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="gk-input"
        />
      </label>
      {files.length > 0 && <p className="gk-meta">{files.length}장 선택됨{tooMany ? ` · ${IMPORT_MAX_IMAGES}장까지만 올릴 수 있어요` : ''}</p>}
      <button type="button" className="gk-btn gk-btn-primary" disabled={!!busy || files.length === 0 || tooMany} onClick={() => onUpload(files)}>
        {busy ?? '판독 시작'}
      </button>
    </div>
  );
}
