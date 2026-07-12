import { useLocation } from 'react-router-dom';
import { apiClient } from '@/api/backendClient';
import { useQuery } from '@tanstack/react-query';


export default function PageNotFound({}) {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const user = await apiClient.auth.me();
                return { user, isAuthenticated: true };
            } catch (error) {
                return { user: null, isAuthenticated: false };
            }
        }
    });
    
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            <div className="max-w-md w-full">
                <div className="text-center space-y-6">
                    {/* 404 Error Code */}
                    <div className="space-y-2">
                        <h1 className="text-7xl font-light text-muted-foreground">404</h1>
                        <div className="h-0.5 w-16 bg-border mx-auto"></div>
                    </div>
                    
                    {/* Main Message */}
                    <div className="space-y-3">
                        <h2 className="text-2xl font-heading font-medium text-foreground">
                            Сторінку не знайдено
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            На жаль, сторінка <span className="font-medium text-foreground">"{pageName}"</span> не існує на сайті ФінОк.
                        </p>
                    </div>
                    
                    {/* Admin Note */}
                    {isFetched && authData.isAuthenticated && authData.user?.role === 'ADMIN' && (
                        <div className="mt-8 p-4 bg-card rounded-lg border border-border">
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center mt-0.5">
                                    <div className="w-2 h-2 rounded-full bg-destructive"></div>
                                </div>
                                <div className="text-left space-y-1">
                                    <p className="text-sm font-medium text-foreground">Примітка адміна</p>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Сторінка ще не створена. Напишіть системі запит на реалізацію.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="pt-6 space-y-3">
                        <button 
                            onClick={() => window.location.href = '/'} 
                            className="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-primary-foreground bg-primary rounded hover:opacity-90 transition-opacity"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            На головну
                        </button>
                        <a 
                            href="https://t.me/finok_ua" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-foreground border border-border rounded hover:border-primary hover:text-primary transition-colors"
                        >
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0m5.37 8.4l-2.1 9.8c-.15.75-.55 1.05-1.1.65l-3-2.2-1.45 1.4c-.16.16-.3.3-.6.3l.2-3.1 5.65-5.1c.25-.22-.05-.35-.4-.12L8 12.5l-3.1-.95c-.65-.2-.65-.65.15-.95l12.1-4.65c.55-.2 1.05.13.85.95z"/>
                            </svg>
                            Написати в Telegram
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}