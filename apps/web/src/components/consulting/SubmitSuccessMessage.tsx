interface SubmitSuccessMessageProps {
  requestId: string;
}

export default function SubmitSuccessMessage({ requestId }: SubmitSuccessMessageProps) {
  return (
    <div className="rounded-[24px] border border-success bg-success-tint p-5 sm:p-6">
      <p className="text-lg font-semibold text-success">요청이 접수되었습니다.</p>
      <p className="mt-2 text-sm leading-relaxed text-success">
        포트폴리오 스크린샷과 고민이 전달되었습니다. 확인용 요청 ID는 <span className="font-semibold">{requestId}</span> 입니다.
      </p>
    </div>
  );
}
