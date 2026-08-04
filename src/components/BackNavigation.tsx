import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { useBreadcrumbNav } from '@/hooks/useBreadcrumbNav';

interface BackNavigationProps {
  title?: string;
  showHome?: boolean;
}

export const BackNavigation = ({ title, showHome = true }: BackNavigationProps) => {
  const navigate = useNavigate();
  const { goBack } = useBreadcrumbNav();

  // Breadcrumb back: returns to the exact previous screen and re-opens the
  // overlay (profile popup, etc.) that was showing on it.
  const handleBack = () => goBack();

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="container mx-auto px-3 py-1 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="h-8 w-8"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        {title && (
          <h1 className="text-base font-semibold flex-1 truncate">{title}</h1>
        )}
        
        {showHome && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="h-8 w-8 ml-auto"
            aria-label="Go home"
          >
            <Home className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
