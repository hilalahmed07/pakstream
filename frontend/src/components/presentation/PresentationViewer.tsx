import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Presentation, PresentationSlide } from '../../types/presentation';
import presentationService from '../../services/presentationService';
import { getBaseUrl } from '../../config/api';

interface PresentationViewerProps {
  presentation: Presentation;
  onClose: () => void;
}

const PresentationViewer: React.FC<PresentationViewerProps> = ({ presentation, onClose }) => {
  const [slides, setSlides] = useState<PresentationSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingSlides, setLoadingSlides] = useState<Set<number>>(new Set());
  const [preloadedSlides, setPreloadedSlides] = useState<Set<number>>(new Set());
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Auto-play slides
  useEffect(() => {
    if (isPlaying && slides.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentSlide(prev => {
          if (prev >= slides.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 5000); // 5 seconds per slide
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, slides.length]);

  // Load slides and track view
  useEffect(() => {
    loadSlides();
    // Track view when presentation is opened (only once per session)
    const sessionKey = `presentation_view_${presentation._id}`;
    const hasTracked = sessionStorage.getItem(sessionKey);
    
    if (!hasTracked) {
      presentationService.trackView(presentation._id).catch(err => {
        console.warn('Failed to track view:', err);
      });
      sessionStorage.setItem(sessionKey, 'true');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload adjacent slides
  useEffect(() => {
    preloadAdjacentSlides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlide, slides]);

  const loadSlides = async () => {
    try {
      setIsLoading(true);
      const response = await presentationService.getPresentationSlides(presentation._id);
      setSlides(response.slides);
    } catch (error) {
      console.error('Failed to load slides:', error);
      setError('Failed to load presentation slides');
    } finally {
      setIsLoading(false);
    }
  };

  const preloadAdjacentSlides = useCallback(() => {
    if (slides.length === 0) return;

    const slidesToPreload = [
      currentSlide - 1,
      currentSlide + 1,
      currentSlide + 2
    ].filter(index => index >= 0 && index < slides.length);

    slidesToPreload.forEach(index => {
      if (!preloadedSlides.has(index)) {
        const img = new Image();
        const baseUrl = getBaseUrl();
        img.src = `${baseUrl}/uploads/${slides[index].imagePath}`;
        img.onload = () => {
          setPreloadedSlides(prev => new Set(prev).add(index));
        };
      }
    });
  }, [currentSlide, slides, preloadedSlides]);

  const nextSlide = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  }, [currentSlide, slides.length]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  }, [currentSlide]);

  const goToSlide = useCallback((slideIndex: number) => {
    if (slideIndex >= 0 && slideIndex < slides.length) {
      setCurrentSlide(slideIndex);
    }
  }, [slides.length]);

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(console.error);
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(console.error);
    }
  }, []);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
      case ' ': // Spacebar
        e.preventDefault();
        nextSlide();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        prevSlide();
        break;
      case 'Escape':
        e.preventDefault();
        if (isFullscreen) {
          toggleFullscreen();
        } else {
          onClose();
        }
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        togglePlay();
        break;
      case 'Home':
        e.preventDefault();
        goToSlide(0);
        break;
      case 'End':
        e.preventDefault();
        goToSlide(slides.length - 1);
        break;
    }
  }, [nextSlide, prevSlide, goToSlide, slides.length, toggleFullscreen, togglePlay, isFullscreen, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  const handleImageLoad = () => {
    setLoadingSlides(prev => {
      const newSet = new Set(prev);
      newSet.delete(currentSlide);
      return newSet;
    });
  };

  const handleImageError = () => {
    setError('Failed to load slide image');
    setLoadingSlides(prev => {
      const newSet = new Set(prev);
      newSet.delete(currentSlide);
      return newSet;
    });
  };

  const slideUrl = slides[currentSlide] 
    ? (() => {
        const baseUrl = getBaseUrl();
        return `${baseUrl}/uploads/${slides[currentSlide].imagePath}`;
      })()
    : '';

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Loading presentation...</p>
          <p className="text-gray-400 mt-2">{presentation.title}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
        <div className="text-center text-white p-8 max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-2xl font-bold mb-2">Presentation Error</h3>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Close Viewer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className={`bg-gradient-to-r from-gray-900 to-black text-white p-4 flex items-center justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold truncate">{presentation.title}</h2>
          <span className="text-sm text-gray-400">
            Slide {currentSlide + 1} of {slides.length}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => presentationService.downloadPresentation(presentation._id)}
            className="bg-netflix-red hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            title="Download presentation file"
          >
            ⬇️ Download
          </button>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white text-2xl font-bold px-3 py-1 hover:bg-gray-800 rounded transition-colors"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div ref={slideRef} className="flex-1 relative overflow-hidden bg-gray-900">
        {slides.length > 0 && (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Loading indicator */}
            {loadingSlides.has(currentSlide) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              </div>
            )}

            {/* Slide Image */}
            <img
              src={slideUrl}
              alt={`Slide ${currentSlide + 1}`}
              className="max-w-full max-h-full object-contain transition-opacity duration-300"
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ display: loadingSlides.has(currentSlide) ? 'none' : 'block' }}
            />
          </div>
        )}

        {/* Slide Navigation Arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className={`absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed ${showControls ? 'opacity-100' : 'opacity-0'}`}
              title="Previous slide (←)"
            >
              ←
            </button>
            <button
              onClick={nextSlide}
              disabled={currentSlide === slides.length - 1}
              className={`absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed ${showControls ? 'opacity-100' : 'opacity-0'}`}
              title="Next slide (→)"
            >
              →
            </button>
          </>
        )}
      </div>

      {/* Bottom Controls */}
      <div className={`bg-gradient-to-t from-black to-transparent p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="container mx-auto">
          {/* Slide Indicator Bar */}
          {slides.length > 1 && (
            <div className="mb-4">
              <div className="flex items-center space-x-1 overflow-x-auto pb-2">
                {slides.map((slide, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={`flex-shrink-0 rounded overflow-hidden transition-all ${
                      currentSlide === index 
                        ? 'ring-2 ring-white scale-110' 
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    title={`Go to slide ${index + 1}`}
                  >
                    <img
                      src={(() => {
                        const baseUrl = getBaseUrl();
                        return `${baseUrl}/uploads/${slide.thumbnailPath || slide.imagePath}`;
                      })()}
                      alt={`Slide ${index + 1}`}
                      className="w-16 h-12 object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-all"
              title="Previous (←)"
            >
              ← Previous
            </button>
            
            <button
              onClick={togglePlay}
              className="bg-netflix-red hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-all"
              title={isPlaying ? 'Pause (P)' : 'Play (P)'}
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            
            <button
              onClick={nextSlide}
              disabled={currentSlide === slides.length - 1}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-all"
              title="Next (→)"
            >
              Next →
            </button>
            
            <button
              onClick={toggleFullscreen}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-2 rounded-lg transition-all"
              title="Fullscreen (F)"
            >
              {isFullscreen ? '⤢ Exit' : '⤡ Fullscreen'}
            </button>
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div className="mt-4 text-center text-gray-400 text-xs">
            <p>Keyboard shortcuts: ← → navigate • Space play/pause • F fullscreen • Esc close</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationViewer;
