import { Suspense } from 'react';

import { ReelsContainer } from '@/components/reels/reels-container';
import { ReelsLoading } from '@/components/reels/reels-loading';
import { Header } from '@/components/layout/header';

export default function HomePage() {
  return (
    <div className='flex h-screen flex-col bg-black'>
      <Header />
      <div className='flex-1 overflow-hidden'>
        <Suspense fallback={<ReelsLoading />}>
          <ReelsContainer />
        </Suspense>
      </div>
    </div>
  );
}
