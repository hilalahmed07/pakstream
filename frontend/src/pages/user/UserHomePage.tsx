import React, { useState, useEffect } from 'react';
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
import { Video } from '../../types/video';
import { Presentation } from '../../types/presentation';
import { Document } from '../../types/document';
import { Premiere } from '../../types/premiere';

const UserHomePage: React.FC = () => {
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
  const [upcomingPremieres, setUpcomingPremieres] = useState<Premiere[]>([]);
  const [premieresLoading, setPremieresLoading] = useState(false);

  useEffect(() => {
    initializeApp();
    // Check every 5 seconds to catch status updates faster when countdown finishes
    const interval = setInterval(checkActivePremiere, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchVideos(),
        fetchPresentations(),
        fetchDocuments(),
        checkActivePremiere(),
        fetchUpcomingPremieres()
      ]);
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
      const response = await premiereService.getActivePremiere();
      
      if (response.data.premiere) {
        const premiere = response.data.premiere;
        const timeUntilStart = premiereService.getTimeUntilStart(premiere.startTime);
        const threeMinutesInMs = 3 * 60 * 1000; // 3 minutes in milliseconds
        
        // Always show live premieres
        if (premiereService.isPremiereLive(premiere)) {
          setActivePremiere(prev => {
            if (prev && prev._id === premiere._id) {
              if (prev.status !== premiere.status) {
                return premiere;
              }
              return prev;
            }
            return premiere;
          });
          setShowPremiere(true);
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
            }
            return;
          }
          
          // Show scheduled premiere if within 3 minutes OR countdown finished
          setActivePremiere(prev => {
            if (prev && prev._id === premiere._id) {
              if (prev.status !== premiere.status) {
                return premiere;
              }
              return prev;
            }
            return premiere;
          });
          setShowPremiere(true);
          return;
        }
        
        // Fallback: show premiere if it exists
        setActivePremiere(prev => {
          if (prev && prev._id === premiere._id) {
            if (prev.status !== premiere.status) {
              return premiere;
            }
            return prev;
          }
          return premiere;
        });
        setShowPremiere(true);
      } else {
        if (activePremiere !== null) {
          setActivePremiere(null);
          setShowPremiere(false);
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
    setShowPremiere(false);
    setActivePremiere(null);
  };

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
      {/* Live Premiere */}
      {showPremiere && activePremiere && (
        <div className="mb-8">
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
            />
          ) : null}
        </div>
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

      {/* Premieres Section */}
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

