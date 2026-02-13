import { BrowserRouter } from 'react-router-dom';
import { AuthGuard } from '@/components/AuthGuard';

function App() {
  return (
    <BrowserRouter>
      <AuthGuard />
    </BrowserRouter>
  );
}

export default App;
