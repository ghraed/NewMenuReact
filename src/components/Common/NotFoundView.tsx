import React from 'react';
import { GlassBoard } from '../ui/liquid-glass';

interface NotFoundViewProps {
  title?: string;
  message?: string;
}

const NotFoundView: React.FC<NotFoundViewProps> = ({
  title = '404',
  message = 'The requested page could not be found.',
}) => (
  <div className="flex min-h-screen items-center justify-center p-4">
    <GlassBoard className="w-full max-w-lg">
      <h1 className="text-2xl font-bold text-text">{title}</h1>
      <p className="mt-2 text-muted">{message}</p>
    </GlassBoard>
  </div>
);

export default NotFoundView;
