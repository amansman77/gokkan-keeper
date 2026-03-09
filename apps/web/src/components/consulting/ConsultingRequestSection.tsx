import type { ReactNode } from 'react';

interface ConsultingRequestSectionProps {
  children: ReactNode;
}

export default function ConsultingRequestSection({ children }: ConsultingRequestSectionProps) {
  return (
    <section className="mx-auto max-w-3xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:p-8">
      <div className="rounded-[24px] bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_55%,#fef7ed_100%)] p-5 sm:p-8">
        <p className="text-sm font-semibold tracking-[0.18em] text-emerald-800">FREE 1-TIME REVIEW</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
          포트폴리오 스크린샷과 고민만 보내주세요.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg">
          복잡한 항목은 빼고, 지금 보이는 포트폴리오와 가장 큰 고민만 받습니다. 1분 안에 요청할 수 있게
          폼을 줄였습니다.
        </p>
      </div>
      <div className="mt-6 sm:mt-8">{children}</div>
    </section>
  );
}
