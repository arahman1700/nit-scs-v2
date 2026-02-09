import { BrowserRouter } from 'react-router-dom';
import { AuthGuard } from '@/components/AuthGuard';
import { DirectionProvider } from '@/contexts/DirectionProvider';

function App() {
  return (
    <DirectionProvider>
      <BrowserRouter>
        <AuthGuard />
      </BrowserRouter>
    </DirectionProvider>
  );
}

export default App;
