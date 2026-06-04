import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useAdmin } from '@/hooks/useAdmin';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Home, MessageCircle, Users, Compass, Bookmark, BarChart3, Settings, Star, Crown, BadgeCheck, FileText, Receipt, HelpCircle, LogOut, ChevronRight } from 'lucide-react';
interface MenuPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}
export const MenuPanel = ({
  isOpen,
  onOpenChange,
  trigger
}: MenuPanelProps) => {
  const {
    user,
    signOut
  } = useAuth();
  const {
    profile
  } = useProfile();
  const {
    isAdmin
  } = useAdmin();
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
    onOpenChange(false);
  };
  const handleNavigation = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };
  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    variant = 'default'
  }: {
    icon: any;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive';
  }) => <div onClick={onClick} className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 ${variant === 'destructive' ? 'hover:bg-destructive/10 hover:shadow-sm' : 'hover:bg-muted hover:shadow-md hover:scale-[1.02]'}`}>
      <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${variant === 'destructive' ? 'bg-destructive/10 group-hover:bg-destructive/20' : 'bg-muted group-hover:bg-primary/10'}`}>
        <Icon className={`h-5 w-5 transition-all duration-300 ${variant === 'destructive' ? 'text-destructive group-hover:scale-110' : 'text-foreground group-hover:text-primary group-hover:scale-110'}`} />
      </div>
      <span className={`text-sm font-medium transition-all duration-300 ${variant === 'destructive' ? 'text-destructive' : 'text-foreground group-hover:text-primary'}`}>
        {label}
      </span>
    </div>;
  return <Sheet open={isOpen} onOpenChange={onOpenChange}>
    {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
    <SheetContent side="right" className="w-[400px] p-6 overflow-y-auto bg-background/95 backdrop-blur-xl border-l">
      {/* Profile Section */}
      <div onClick={() => handleNavigation(`/profile/${user?.id}`)} className="group gap-3 p-4 rounded-2xl hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 cursor-pointer transition-all duration-300 mb-6 border border-transparent hover:border-primary/20 hover:scale-[1.02] flex items-center justify-end opacity-80 shadow-md">
        <div className="relative">
          <Avatar className="h-14 w-14 ring-2 ring-background group-hover:ring-primary/50 transition-all duration-300">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-primary/20 to-primary/10">
              {profile?.display_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-online rounded-full ring-2 ring-background" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-base truncate text-foreground group-hover:text-primary transition-colors duration-300">
              {profile?.display_name || 'User'}
            </p>
            {isAdmin && <Badge variant="destructive" className="gap-1 px-1.5 py-0 h-5">
              <span className="text-[10px] font-semibold">ADMIN</span>
            </Badge>}
          </div>
          <p className="text-sm text-muted-foreground truncate">@{profile?.username || 'username'}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
      </div>

      <Separator className="my-6 bg-border/50" />

      {/* Shortcuts Section */}
      <div className="space-y-1.5 mb-6">{" "}
        <MenuItem icon={Home} label="Dashboard" onClick={() => handleNavigation('/dashboard')} />
        <MenuItem icon={BarChart3} label="Analytics" onClick={() => handleNavigation('/analytics')} />
        <MenuItem icon={Compass} label="Explore" onClick={() => handleNavigation('/explore')} />
        <MenuItem icon={Bookmark} label="Saved" onClick={() => handleNavigation('/bookmarks')} />
        <MenuItem icon={FileText} label="Pages" onClick={() => handleNavigation('/pages')} />
        <MenuItem icon={Star} label="Reels" onClick={() => handleNavigation('/reels')} />
        <MenuItem icon={MessageCircle} label="Messages" onClick={() => handleNavigation('/messages')} />
        <MenuItem icon={Users} label="Friends" onClick={() => handleNavigation('/friends')} />


      </div>

      <Separator className="my-6 bg-border/50" />

      {/* Premium & Verification */}
      <div className="space-y-1.5 mb-6">
        <div onClick={() => handleNavigation('/verification')} className="group flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-warning/10 hover:to-warning/5 transition-all duration-300 hover:shadow-md hover:scale-[1.02] border border-transparent hover:border-warning/20">
          <div className="h-10 w-10 rounded-full bg-warning/10 group-hover:bg-warning/20 flex items-center justify-center flex-shrink-0 transition-all duration-300">
            <BadgeCheck className="h-5 w-5 text-warning group-hover:scale-110 transition-transform duration-300" />
          </div>
          <span className="text-sm font-medium text-foreground group-hover:text-warning transition-colors duration-300">Get Verified</span>
        </div>

        <div onClick={() => handleNavigation('/premium')} className="group flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-warning/10 hover:to-warning/5 transition-all duration-300 hover:shadow-md hover:scale-[1.02] border border-transparent hover:border-warning/20">
          <div className="h-10 w-10 rounded-full bg-warning/10 group-hover:bg-warning/20 flex items-center justify-center flex-shrink-0 transition-all duration-300">
            <Crown className="h-5 w-5 text-warning group-hover:scale-110 transition-transform duration-300" />
          </div>
          <span className="text-sm font-medium text-foreground group-hover:text-warning transition-colors duration-300">Go Premium</span>
        </div>

        <MenuItem icon={Receipt} label="Purchase History" onClick={() => handleNavigation('/purchases')} />
      </div>

      <Separator className="my-6 bg-border/50" />

      {/* Settings & Privacy */}
      <div className="space-y-1.5 mb-6">{" "}
        <MenuItem icon={Settings} label="Settings & Privacy" onClick={() => handleNavigation('/settings')} />
      </div>

      <Separator className="my-6 bg-border/50" />

      {/* Help & Support */}
      <div className="space-y-1.5 mb-6">
        <div onClick={() => window.open('https://post-upp-faq-how-to-use.htmlhost.co', '_blank')} className="group flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-muted hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
          <div className="h-10 w-10 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center flex-shrink-0 transition-all duration-300">
            <HelpCircle className="h-5 w-5 text-foreground group-hover:text-primary group-hover:scale-110 transition-all duration-300" />
          </div>
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-300">Help & Support</span>
        </div>
      </div>

      <Separator className="my-6 bg-border/50" />

      {/* Logout */}
      <MenuItem icon={LogOut} label="Log Out" onClick={handleSignOut} variant="destructive" />
    </SheetContent>
  </Sheet>;
};