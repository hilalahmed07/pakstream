import React, { useState, useEffect, useRef } from 'react';
import HeroSection from '../../components/HeroSection';
import VideoGrid from '../../components/video/VideoGrid';
import PresentationGrid from '../../components/presentation/PresentationGrid';
import DocumentGrid from '../../components/document/DocumentGrid';
import VideoPlayer from '../../components/video/VideoPlayer';
import PresentationViewer from '../../components/presentation/PresentationViewer';
import DocumentViewer from '../../components/document/DocumentViewer';
import LivePremiere from '../../components/premiere/LivePremiere';
import ScheduledPremiere from '../../components/premiere/ScheduledPremiere';
import PremiereGrid from '../../components/premiere/PremiereGrid';
import VideoProcessingStatus from '../../components/video/VideoProcessingStatus';
import videoService from '../../services/videoService';
import presentationService from '../../services/presentationService';
import documentService from '../../services/documentService';
import premiereService from '../../services/premiereService';
import { useAuth } from '../../hooks';
import { Video } from '../../types/video';
import { Presentation } from '../../types/presentation';
import { Document } from '../../types/document';
import { Premiere } from '../../types/premiere';

const UserHomePage: React.FC = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [showPresentationViewer, setShowPresentationViewer] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [activePremiere, setActivePremiere] = useState<Premiere | null>(null);
  const [showPremiere, setShowPremiere] = useState(false);
  const [premiereDismissed, setPremiereDismissed] = useState(false);
  const [upcomingPremieres, setUpcomingPremieres] = useState<Premiere[]>([]);
  const [premieresLoading, setPremieresLoading] = useState(false);
  const reappearIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activePremiereRef = useRef<Premiere | null>(null);

  useEffect(() => {
    initializeApp();
    // Check every 5 seconds to catch status updates faster when countdown finishes
    const interval = setInterval(checkActivePremiere, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check premiere when user state changes (e.g., after login)
  useEffect(() => {
    if (user && user.role !== 'admin') {
      checkActivePremiere();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const initializeApp = async () => {
    try {
      setLoading(true);
      const promises = [
        fetchVideos(),
        fetchPresentations(),
        fetchDocuments()
      ];
      
      // Only check premieres if user is logged in (non-admin)
      if (user && user.role !== 'admin') {
        promises.push(checkActivePremiere(), fetchUpcomingPremieres());
      }
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to initialize app:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVideos = async () => {
    try {
      const response = await videoService.getVideos({ limit: 12 });
      setVideos(response.data.videos);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    }
  };

  const fetchUpcomingPremieres = async () => {
    // Only fetch premieres for logged-in users (non-admin)
    if (!user || user.role === 'admin') {
      setUpcomingPremieres([]);
      return;
    }

    try {
      setPremieresLoading(true);
      const response = await premiereService.getUpcomingPremieres();
      setUpcomingPremieres(response.data.premieres || []);
    } catch (error) {
      console.error('Failed to fetch upcoming premieres:', error);
      setUpcomingPremieres([]);
    } finally {
      setPremieresLoading(false);
    }
  };

  const fetchPresentations = async () => {
    try {
      const response = await presentationService.getPresentations({ limit: 12 });
      setPresentations(response.presentations);
    } catch (error) {
      console.error('Failed to fetch presentations:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await documentService.getDocuments({ limit: 12 });
      setDocuments(response.documents);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const checkActivePremiere = async () => {
    try {
      // Only show premiere popup for logged-in users (non-admin)
      // Don't show if user is not logged in or if user is admin
      if (!user || user.role === 'admin') {
        // Clear premiere state if user is not logged in or is admin
        if (activePremiere !== null) {
          setActivePremiere(null);
          activePremiereRef.current = null;
          setShowPremiere(false);
          setPremiereDismissed(false);
          if (reappearIntervalRef.current) {
            clearInterval(reappearIntervalRef.current);
            reappearIntervalRef.current = null;
          }
        }
        return;
      }

      console.log('🔍 Checking for active premiere...', { userId: user._id, role: user.role });
      const response = await premiereService.getActivePremiere();
      console.log('📺 Active premiere response:', response.data);
      
      if (response.data.premiere) {
        const premiere = response.data.premiere;
        const timeUntilStart = premiereService.getTimeUntilStart(premiere.startTime);
        const threeMinutesInMs = 3 * 60 * 1000; // 3 minutes in milliseconds
        
        console.log('🎬 Found premiere:', {
          id: premiere._id,
          title: premiere.title,
          status: premiere.status,
          startTime: premiere.startTime,
          timeUntilStart: timeUntilStart,
          timeUntilStartMinutes: Math.floor(timeUntilStart / 60000),
          within3Minutes: timeUntilStart <= threeMinutesInMs
        });
        
        // Always show live premieres
        if (premiereService.isPremiereLive(premiere)) {
          setActivePremiere(prev => {
            // If this is a different premiere, reset dismissed state
            if (prev && prev._id !== premiere._id) {
              setPremiereDismissed(false);
              // Clear any existing reappear interval for old premiere
              if (reappearIntervalRef.current) {
                clearInterval(reappearIntervalRef.current);
                reappearIntervalRef.current = null;
              }
            }
            
            if (prev && prev._id === premiere._id) {
              if (prev.status !== premiere.status) {
                activePremiereRef.current = premiere;
                return premiere;
              }
              activePremiereRef.current = prev;
              return prev;
            }
            activePremiereRef.current = premiere;
            return premiere;
          });
          setShowPremiere(true);
          setPremiereDismissed(false);
          // Clear any reappear interval for live premieres
          if (reappearIntervalRef.current) {
            clearInterval(reappearIntervalRef.current);
            reappearIntervalRef.current = null;
          }
          return;
        }
        
        // For scheduled premieres, only show if within 3 minutes of start OR countdown has finished
        if (premiereService.isPremiereScheduled(premiere)) {
          // Show if within 3 minutes OR if countdown has finished (timeUntilStart <= 0)
          // This handles the case where countdown finished but backend hasn't updated status yet
          if (timeUntilStart > threeMinutesInMs && timeUntilStart > 0) {
            // Hide premiere if more than 3 minutes away AND countdown hasn't finished
            if (activePremiere !== null) {
              setActivePremiere(null);
              setShowPremiere(false);
              setPremiereDismissed(false);
            }
            return;
          }
          
          // Show scheduled premiere if within 3 minutes OR countdown finished
          setActivePremiere(prev => {
            // If this is a different premiere, reset dismissed state
            if (prev && prev._id !== premiere._id) {
              setPremiereDismissed(false);
              // Clear any existing reappear interval for old premiere
              if (reappearIntervalRef.current) {
                clearInterval(reappearIntervalRef.current);
                reappearIntervalRef.current = null;
              }
            }
            
            if (prev && prev._id === premiere._id) {
              if (prev.status !== premiere.status) {
                activePremiereRef.current = premiere;
                return premiere;
              }
              activePremiereRef.current = prev;
              return prev;
            }
            activePremiereRef.current = premiere;
            return premiere;
          });
          
          // Check if this premiere was previously dismissed
          const dismissedKey = `premiere_dismissed_${premiere._id}`;
          const wasDismissed = localStorage.getItem(dismissedKey) === 'true';
          setPremiereDismissed(wasDismissed);
          
          // Show premiere (will be positioned based on dismissal state)
          setShowPremiere(true);
          return;
        }
        
        // Fallback: show premiere if it exists
        setActivePremiere(prev => {
          if (prev && prev._id === premiere._id) {
            if (prev.status !== premiere.status) {
              activePremiereRef.current = premiere;
              return premiere;
            }
            activePremiereRef.current = prev;
            return prev;
          }
          activePremiereRef.current = premiere;
          return premiere;
        });
        setShowPremiere(true);
        setPremiereDismissed(false);
      } else {
        if (activePremiere !== null) {
          setActivePremiere(null);
          activePremiereRef.current = null;
          setShowPremiere(false);
          setPremiereDismissed(false);
          // Clear reappear interval when no active premiere
          if (reappearIntervalRef.current) {
            clearInterval(reappearIntervalRef.current);
            reappearIntervalRef.current = null;
          }
        }
      }
    } catch (error) {
      console.error('Failed to check active premiere:', error);
    }
  };

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video);
    setShowVideoPlayer(true);
  };

  const handlePresentationClick = (presentation: Presentation) => {
    setSelectedPresentation(presentation);
    setShowPresentationViewer(true);
  };

  const handleDocumentClick = (document: Document) => {
    setSelectedDocument(document);
    setShowDocumentViewer(true);
  };

  const handleCloseVideoPlayer = () => {
    setShowVideoPlayer(false);
    setSelectedVideo(null);
  };

  const handleClosePresentationViewer = () => {
    setShowPresentationViewer(false);
    setSelectedPresentation(null);
  };

  const handleCloseDocumentViewer = () => {
    setShowDocumentViewer(false);
    setSelectedDocument(null);
  };

  const handleClosePremiere = () => {
    if (activePremiere) {
      // Mark this premiere as dismissed in localStorage
      const dismissedKey = `premiere_dismissed_${activePremiere._id}`;
      localStorage.setItem(dismissedKey, 'true');
      setPremiereDismissed(true);
      setShowPremiere(false);
      
      // Clear any existing interval
      if (reappearIntervalRef.current) {
        clearInterval(reappearIntervalRef.current);
      }
      
      // Set up interval to reappear every 30 seconds
      reappearIntervalRef.current = setInterval(() => {
        // Only reappear if premiere is still active and within 3 minutes
        const currentPremiere = activePremiereRef.current;
        if (currentPremiere) {
          const timeUntilStart = premiereService.getTimeUntilStart(currentPremiere.startTime);
          const threeMinutesInMs = 3 * 60 * 1000;
          
          // Only show if within 3 minutes or countdown finished
          if (timeUntilStart <= threeMinutesInMs || timeUntilStart <= 0) {
            setShowPremiere(true);
          } else {
            // If more than 3 minutes away, clear interval
            if (reappearIntervalRef.current) {
              clearInterval(reappearIntervalRef.current);
              reappearIntervalRef.current = null;
            }
          }
        } else {
          // If no active premiere, clear interval
          if (reappearIntervalRef.current) {
            clearInterval(reappearIntervalRef.current);
            reappearIntervalRef.current = null;
          }
        }
      }, 30000); // 30 seconds
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (reappearIntervalRef.current) {
        clearInterval(reappearIntervalRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-center text-text-primary">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-xl">Loading PakStream...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Live Premiere - Only show for logged-in users (non-admin) */}
      {showPremiere && activePremiere && user && user.role !== 'admin' && (
        <>
          {premiereService.isPremiereLive(activePremiere) ? (
            <LivePremiere 
              premiere={activePremiere} 
              onClose={handleClosePremiere}
            />
          ) : premiereService.isPremiereScheduled(activePremiere) ? (
            <ScheduledPremiere 
              premiere={activePremiere} 
              onClose={handleClosePremiere}
              onCountdownFinish={checkActivePremiere}
              isDismissed={premiereDismissed}
            />
          ) : null}
        </>
      )}

      {/* Hero Section */}
      <HeroSection />

      {/* Videos Section */}
      <section id="videos" className="py-10">
        <div className="container mx-auto px-6">
          <div className="mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">
              Videos
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-accent to-transparent rounded-full"></div>
          </div>
          <VideoGrid 
            videos={videos} 
            loading={loading}
            onVideoClick={handleVideoClick}
          />
        </div>
      </section>

      {/* Presentations Section */}
      <section id="presentations" className="py-10">
        <div className="container mx-auto px-6">
          <div className="mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">
              Presentations
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-accent to-transparent rounded-full"></div>
          </div>
          <PresentationGrid 
            presentations={presentations} 
            onPresentationClick={handlePresentationClick}
          />
        </div>
      </section>

      {/* Documents Section */}
      <section id="documents" className="py-10">
        <div className="container mx-auto px-6">
          <div className="mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">
              Documents
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-accent to-transparent rounded-full"></div>
          </div>
          <DocumentGrid 
            documents={documents} 
            onDocumentClick={handleDocumentClick}
          />
        </div>
      </section>

      {/* Premieres Section - Only show for logged-in users (non-admin) */}
      {user && user.role !== 'admin' && (
        <section id="premieres" className="py-10">
          <div className="container mx-auto px-6">
            <div className="mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">
                Premieres
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-accent to-transparent rounded-full"></div>
            </div>
            <PremiereGrid 
              premieres={upcomingPremieres} 
              loading={premieresLoading}
            />
          </div>
        </section>
      )}

      {/* Video Player Modal */}
      {showVideoPlayer && selectedVideo && (
        <div className="fixed inset-0 bg-black z-50 video-player-fullscreen">
          <VideoPlayer
            video={selectedVideo}
            onClose={handleCloseVideoPlayer}
            autoPlay={true}
            controls={true}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Presentation Viewer Modal */}
      {showPresentationViewer && selectedPresentation && (
        <PresentationViewer
          presentation={selectedPresentation}
          onClose={handleClosePresentationViewer}
        />
      )}

      {/* Document Viewer Modal */}
      {showDocumentViewer && selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          onClose={handleCloseDocumentViewer}
        />
      )}

      {/* Video Processing Status */}
      <VideoProcessingStatus 
        onVideoReady={(videoId) => {
          console.log('Video ready:', videoId);
          fetchVideos();
        }}
      />
    </>
  );
};

export default UserHomePage;

