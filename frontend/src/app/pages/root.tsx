import { Outlet } from 'react-router';
import { InterviewProvider } from '../context/interview-context';
import { ThemeProvider } from 'next-themes';

export default function Root() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <InterviewProvider>
        <Outlet />
      </InterviewProvider>
    </ThemeProvider>
  );
}