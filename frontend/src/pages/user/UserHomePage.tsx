import React, { useState, useEffect, useRef } from 'react';
import HeroSection from '../../components/HeroSection';
import VideoGrid from '../../components/video/VideoGrid';
import PresentationGrid from '../../components/presentation/PresentationGrid';
import DocumentGrid from '../../components/document/DocumentGrid';
import PatchGrid from '../../components/patch/PatchGrid';
import VideoPlayer from '../../components/video/VideoPlayer'; 
import PresentationViewer from '../../components/presentation/PresentationViewer';
import DocumentViewer from '../../components/document/DocumentViewer';
import LivePremiere from '../../components/premiere/LivePremiere';
import ScheduledPremiere from '../../components/premiere/ScheduledPremiere';
import PremiereGrid from '../../components/premiere/PremiereGrid';
import PremiereDetailModal from '../../components/premiere/PremiereDetailModal';
import VideoProcessingStatus from '../../components/video/VideoProcessingStatus';
import Pagination from '../../components/common/Pagination';
import videoService from '../../services/videoService';
import presentationService from '../../services/presentationService';
import documentService from '../../services/documentService';
import patchService from '../../services/patchService';
import premiereService from '../../services/premiereService';
import { useAuth } from '../../hooks';
import { Video } from '../../types/video';
import { Presentation } from '../../types/presentation';
import { Document } from '../../types/document';
import { Patch } from '../../types/patch';
import { Premiere } from '../../types/premiere';

const UserHomePage: React.FC = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [patches, setPatches] = useState<Patch[]>([]);
  const [videoPage, setVideoPage] = useState(1);
  const [documentPage, setDocumentPage] = useState(1);
  const [presentationPage, setPresentationPage] = useState(1);
  const [patchPage, setPatchPage] = useState(1);
  const [videoPagination, setVideoPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [documentPagination, setDocumentPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [presentationPagination, setPresentationPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [patchPagination, setPatchPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [hasFetchedVideos, setHasFetchedVideos] = useState(false);
  const [hasFetchedDocuments, setHasFetchedDocuments] = useState(false);
  const [hasFetchedPresentations, setHasFetchedPresentations] = useState(false);
  const [hasFetchedPatches, setHasFetchedPatches] = useState(false);
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
  const [selectedPremiere, setSelectedPremiere] = useState<Premiere | null>(null);
  const reappearIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activePremiereRef = useRef<Premiere | null>(null);

  useEffect(() => {
    initializeApp();

    checkActivePremiere();
    const interval = setInterval(checkActivePremiere, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check premiere and fetch upcoming list when user state changes (e.g., after login)
  useEffect(() => {
    if (user && user.role !== 'admin') {
      checkActivePremiere();
      fetchUpcomingPremieres();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const initializeApp = async () => {
    try {
      setLoading(true);
      const promises: Promise<void>[] = [];
      if (user && user.role !== 'admin') {
        promises.push(checkActivePremiere(), fetchUpcomingPremieres());
      }
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  };

  const fetchVideos = async () => {
    try {
      // const response = await videoService.getVideos({ page: videoPage, limit: 10 }); 
      const response = await videoService.getVideos({ page: videoPage, limit: 4 }); 
      setVideos(response.data.videos);
      setVideoPagination(response.data.pagination || { current: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setHasFetchedVideos(true);
    }
  };

  useEffect(() => {
    fetchVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoPage]);

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
      // const response = await presentationService.getPresentations({ page: presentationPage, limit: 10 }); for testing
      const response = await presentationService.getPresentations({ page: presentationPage, limit: 4 });
      setPresentations(response.presentations);
      setPresentationPagination(response.pagination || { current: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch presentations:', error);
    } finally {
      setHasFetchedPresentations(true);
    }
  };

  const fetchDocuments = async () => {
    try {
      // const response = await documentService.getDocuments({ page: documentPage, limit: 4 });  // for testing
      const response = await documentService.getDocuments({ page: documentPage, limit: 4 });
      setDocuments(response.documents);
      setDocumentPagination(response.pagination || { current: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setHasFetchedDocuments(true);
    }
  };

  const fetchPatches = async () => {
    try {
      const response = await patchService.getPatches({ page: patchPage, limit: 4 });
      setPatches(response.patches);
      setPatchPagination(response.pagination || { current: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch patches:', error);
    } finally {
      setHasFetchedPatches(true);
    }
  };

  useEffect(() => {
    fetchPresentations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationPage]);

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentPage]);

  useEffect(() => {
    fetchPatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patchPage]);

  useEffect(() => {
    if (hasFetchedVideos && hasFetchedDocuments && hasFetchedPresentations && hasFetchedPatches) {
      setLoading(false);
    }
  }, [hasFetchedVideos, hasFetchedDocuments, hasFetchedPresentations, hasFetchedPatches]);

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
        const threeMinutesInMs = 3 * 60 * 1000; 
        
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
        
        // For scheduled premieres, show immediately when created (always show)
        if (premiereService.isPremiereScheduled(premiere)) {
          // Show all scheduled premieres - users should see premiere details immediately when admin creates it
          // Previously only showed within 3 minutes - now show immediately
          
          // Show scheduled premiere immediately
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

  const handlePatchClick = (patch: Patch) => {
    // For patches, we'll trigger download directly instead of opening a viewer
    patchService.downloadPatch(patch._id);
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
        reappearIntervalRef.current = null;
      }
      
      
      reappearIntervalRef.current = setInterval(async () => {
        try {
          
          const response = await premiereService.getActivePremiere();
          
          if (response.data.premiere) {
            const premiere = response.data.premiere;
            const now = new Date();
            const endTime = new Date(premiere.endTime);
            
            
            activePremiereRef.current = premiere;
            setActivePremiere(premiere);
            
            
            if (now < endTime) {
              setShowPremiere(true);
              
              setPremiereDismissed(false);
              localStorage.removeItem(dismissedKey);
            } else {
              // If premiere has ended, clear interval
              if (reappearIntervalRef.current) {
                clearInterval(reappearIntervalRef.current);
                reappearIntervalRef.current = null;
              }
            }
          } else {
            // No active premiere, clear interval
            if (reappearIntervalRef.current) {
              clearInterval(reappearIntervalRef.current);
              reappearIntervalRef.current = null;
            }
          }
        } catch (error) {
          console.error('Error checking status:', error);
          // Continue checking even if there's an error
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
          <Pagination
            currentPage={videoPagination.current}
            totalPages={videoPagination.pages}
            total={videoPagination.total}
            // limit={10} for testing
            limit={4}
            onPageChange={setVideoPage}
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
          <Pagination
            currentPage={presentationPagination.current}
            totalPages={presentationPagination.pages}
            total={presentationPagination.total}
            // limit={10} for testing
            limit={4}
            onPageChange={setPresentationPage}
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
          <Pagination
            currentPage={documentPagination.current}
            totalPages={documentPagination.pages}
            total={documentPagination.total}
            // limit={10} for testing
            limit={4}
            onPageChange={setDocumentPage}
          />
        </div>
      </section>

      {/* Patches Section */}
      <section id="patches" className="py-10">
        <div className="container mx-auto px-6">
          <div className="mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">
              Windows Patches
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-accent to-transparent rounded-full"></div>
          </div>
          <PatchGrid 
            patches={patches} 
            onPatchClick={handlePatchClick}
          />
          <Pagination
            currentPage={patchPagination.current}
            totalPages={patchPagination.pages}
            total={patchPagination.total}
            limit={4}
            onPageChange={setPatchPage}
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
              onCardClick={setSelectedPremiere}
            />
            {selectedPremiere && (
              <PremiereDetailModal
                premiere={selectedPremiere}
                onClose={() => setSelectedPremiere(null)}
                onJoin={() => setSelectedPremiere(null)}
              />
            )}
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

