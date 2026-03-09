import { useEffect } from 'react';
import ConsultingRequestForm from '../components/consulting/ConsultingRequestForm';
import ConsultingRequestSection from '../components/consulting/ConsultingRequestSection';
import { trackEvent } from '../lib/analytics';
import { setSeo } from '../lib/seo';

export default function Consulting() {
  useEffect(() => {
    setSeo({
      title: '무료 구조 점검 요청 | 곶간지기',
      description: '포트폴리오 스크린샷과 고민을 보내는 무료 1회 구조 점검 요청 폼',
    });
    trackEvent('consulting_form_viewed', {
      source: '/consulting',
      device_type: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
      has_screenshot: false,
      concern_length: 0,
    });
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <ConsultingRequestSection>
        <ConsultingRequestForm />
      </ConsultingRequestSection>
    </div>
  );
}
