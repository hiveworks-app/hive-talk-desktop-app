'use client';

import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/shared/ui/Button';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

const ConfettiLottie = forwardRef<
  { play: () => void },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { animationData: any; onComplete: () => void }
>(function ConfettiLottie({ animationData, onComplete }, ref) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lottieRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    play: () => lottieRef.current?.goToAndPlay(0),
  }));

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={animationData}
      loop={false}
      autoplay
      onComplete={onComplete}
      style={{ width: '100%', height: '100%' }}
    />
  );
});

export function CompleteStep({ userName }: { userName: string }) {
  const lottieRef = useRef<{ play: () => void } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [confettiData, setConfettiData] = useState<any>(null);

  useEffect(() => {
    fetch('/center-confetti.json')
      .then(res => res.json())
      .then(setConfettiData)
      .catch(() => {});
  }, []);

  const handleComplete = useCallback(() => {
    setTimeout(() => {
      lottieRef.current?.play();
    }, 500);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-20">
      {/* 이미지 + 텍스트 그룹 */}
      <div className="flex flex-col items-center gap-5">
        <div className="relative overflow-visible">
          {/* 꽃가루 Lottie */}
          {confettiData && (
            <div className="absolute inset-0 bottom-10" style={{ transform: 'scale(2.1)' }}>
              <ConfettiLottie
                ref={lottieRef}
                animationData={confettiData}
                onComplete={handleComplete}
              />
            </div>
          )}
          {/* 벌 이미지 */}
          <img
            src="/signup-complete.png"
            alt="가입 완료"
            className="relative h-[110px] w-[125px] object-contain"
          />
        </div>

        {/* 텍스트 그룹 */}
        <div className="flex flex-col items-center gap-[5px]">
          <span className="text-body font-medium text-[#F2A500]">가입 완료 !</span>
          <span className="text-heading-sm font-semibold text-text-primary">
            {userName}님, 환영해요
          </span>
        </div>
      </div>

      {/* 버튼 */}
      <div className="mt-12 w-full">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => { window.location.href = '/login'; }}
        >
          로그인 페이지로 가기
        </Button>
      </div>
    </div>
  );
}
