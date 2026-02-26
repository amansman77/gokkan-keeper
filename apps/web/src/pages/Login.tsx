import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GOOGLE_CLIENT_ID } from '../lib/config';
import { useAuth } from '../lib/auth-context';
import { loadGoogleIdentityScript, normalizeNextPath } from '../lib/auth';
import { setSeo } from '../lib/seo';

type GoogleCredentialResponse = {
  credential?: string;
};

export default function Login() {
  const { authenticated, loading, loginWithGoogleCredential } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizeNextPath(params.get('next'));
  }, [location.search]);

  useEffect(() => {
    setSeo({
      title: '로그인 | 곳간 지기',
      description: 'Google 계정으로 대시보드와 자산 관리 기능에 접근합니다.',
      robots: 'noindex, nofollow',
    });
  }, []);

  useEffect(() => {
    if (loading || authenticated || !buttonContainerRef.current || !GOOGLE_CLIENT_ID) return;

    let cancelled = false;

    async function initGoogle() {
      try {
        await loadGoogleIdentityScript();
        if (cancelled || !window.google?.accounts?.id || !buttonContainerRef.current) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: GoogleCredentialResponse) => {
            if (!response.credential) {
              setError('로그인에 실패했습니다.');
              return;
            }

            try {
              setSubmitting(true);
              setError(null);
              const redirectTo = await loginWithGoogleCredential(response.credential, nextPath);
              navigate(redirectTo, { replace: true });
            } catch {
              setError('로그인에 실패했습니다.');
            } finally {
              setSubmitting(false);
            }
          },
        });

        buttonContainerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(buttonContainerRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 320,
        });
      } catch {
        if (!cancelled) {
          setError('로그인에 실패했습니다.');
        }
      }
    }

    initGoogle();

    return () => {
      cancelled = true;
    };
  }, [authenticated, loading, loginWithGoogleCredential, navigate, nextPath]);

  if (loading) {
    return <div className="text-gray-600">인증 확인 중...</div>;
  }

  if (authenticated) {
    return <Navigate to={nextPath} replace />;
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
      <p className="text-sm text-gray-600 mt-2">Google 계정으로 private 페이지에 로그인합니다.</p>

      {GOOGLE_CLIENT_ID ? (
        <div className="mt-6 flex justify-center">
          <div ref={buttonContainerRef} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-red-700">Google Client ID가 설정되지 않았습니다.</p>
      )}

      {submitting ? <p className="mt-4 text-sm text-gray-600 text-center">로그인 처리 중...</p> : null}
      {error ? <p className="mt-4 text-sm text-red-700 text-center">{error}</p> : null}

      <div className="mt-6 text-sm">
        <Link to="/" className="text-blue-600 hover:underline">
          랜딩 페이지로 돌아가기
        </Link>
      </div>
    </div>
  );
}
