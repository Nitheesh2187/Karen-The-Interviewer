import { createBrowserRouter } from 'react-router';
import Root from './pages/root';
import Landing from './pages/landing';
import Setup from './pages/setup';
import Preparing from './pages/preparing';
import Interview from './pages/interview';
import Feedback from './pages/feedback';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      {
        index: true,
        Component: Landing,
      },
      {
        path: 'setup',
        Component: Setup,
      },
      {
        path: 'preparing',
        Component: Preparing,
      },
      {
        path: 'interview',
        Component: Interview,
      },
      {
        path: 'feedback',
        Component: Feedback,
      },
    ],
  },
]);
