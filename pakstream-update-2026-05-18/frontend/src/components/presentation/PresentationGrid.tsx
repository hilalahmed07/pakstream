import React, { useState } from 'react';
import { Presentation } from '../../types/presentation';
import presentationService from '../../services/presentationService';

interface PresentationGridProps {
  presentations: Presentation[];
  onPresentationClick: (presentation: Presentation) => void;
}

const PresentationGrid: React.FC<PresentationGridProps> = ({ presentations, onPresentationClick }) => {
  const [localPresentations, setLocalPresentations] = useState<Map<string, { views: number; likes: number; isLiked: boolean }>>(new Map());

  // Initialize local state from presentations when they change
  React.useEffect(() => {
    const newMap = new Map<string, { views: number; likes: number; isLiked: boolean }>();
    presentations.forEach(presentation => {
      newMap.set(presentation._id, {
        views: presentation.views,
        likes: presentation.likes,
        isLiked: presentation.isLiked ?? false
      });
    });
    setLocalPresentations(newMap);
  }, [presentations]);

  const getLocalData = (id: string, defaultViews: number, defaultLikes: number, defaultIsLiked: boolean) => {
    const local = localPresentations.get(id);
    return {
      views: local?.views ?? defaultViews,
      likes: local?.likes ?? defaultLikes,
      isLiked: local?.isLiked ?? defaultIsLiked
    };
  };

  const handleClick = async (presentation: Presentation) => {
    // Don't track view here - it will be tracked in the viewer component
    // This prevents duplicate view tracking
    
    // Call the original click handler
    onPresentationClick(presentation);
  };

  const handleLikeClick = async (e: React.MouseEvent, presentation: Presentation) => {
    e.stopPropagation(); // Prevent triggering the card click
    
    const local = getLocalData(presentation._id, presentation.views, presentation.likes, presentation.isLiked ?? false);
    const action = local.isLiked ? 'unlike' : 'like';
    
    try {
      const result = await presentationService.toggleLike(presentation._id, action);
      setLocalPresentations(prev => {
        const newMap = new Map(prev);
        newMap.set(presentation._id, {
          ...local,
          likes: result.likes,
          isLiked: result.isLiked
        });
        return newMap;
      });
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      business: 'bg-blue-600',
      education: 'bg-green-600',
      marketing: 'bg-purple-600',
      technology: 'bg-gray-600',
      design: 'bg-pink-600',
      other: 'bg-gray-500'
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  if (presentations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-semibold text-text-primary mb-2">No Presentations Found</h3>
        <p className="text-text-secondary">No presentations are available at the moment.</p>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {presentations.map((presentation) => {
        const local = getLocalData(presentation._id, presentation.views, presentation.likes, presentation.isLiked ?? false);
        return (
        <div
          key={presentation._id}
          onClick={() => handleClick(presentation)}
          className="group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:z-10"
        >
          <div className="relative bg-card rounded-lg overflow-hidden shadow-lg hover:bg-card-hover transition-colors">
            {/* Thumbnail */}
            <div className="aspect-video bg-secondary relative overflow-hidden">
              {presentation.thumbnail ? (
                <img
                  src={presentationService.getThumbnailUrl(presentation._id)}
                  alt={presentation.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNzUgMTI1SDIyNVYxNzVIMTc1VjEyNVoiIGZpbGw9IiM2QjcyODAiLz4KPHN2ZyB4PSIxODAiIHk9IjEzMCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgNDAgNDAiIGZpbGw9Im5vbmUiPgo8cGF0aCBkPSJNMTUgMTBIMjVWMjBIMTVWMjBaIiBmaWxsPSIjRkZGRkZGIi8+CjxwYXRoIGQ9Ik0xMCAxNUgyMFYyNUgxMFYxNVoiIGZpbGw9IiNGRkZGRkYiLz4KPHN2ZyB4PSIyNSIgeT0iMjAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIxNSIgdmlld0JveD0iMCAwIDE1IDE1IiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTIgMkgxM0gyVjJaIiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPgo8L3N2Zz4KPC9zdmc+';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-6xl text-text-secondary">📊</div>
                </div>
              )}
              
              {/* Status Badge */}
              <div className="absolute top-2 left-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  presentation.status === 'ready' 
                    ? 'bg-green-600 text-white' 
                    : presentation.status === 'processing'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-red-600 text-white'
                }`}>
                  {presentation.status === 'ready' ? 'Ready' : 
                   presentation.status === 'processing' ? 'Processing' : 'Error'}
                </span>
              </div>

              {/* Category Badge */}
              <div className="absolute top-2 right-2">
                <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getCategoryColor(presentation.category)}`}>
                  {presentation.category}
                </span>
              </div>

              {/* Slide Count */}
              <div className="absolute bottom-2 right-2">
                <span className="bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                  {presentation.totalSlides} slides
                </span>
              </div>

              {/* Play Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-text-primary ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="text-text-primary font-semibold text-lg mb-2 line-clamp-1 group-hover:text-accent transition-colors" title={presentation.title}>
                {presentation.title}
              </h3>

              <p className="text-text-secondary text-sm mb-3 line-clamp-2" title={presentation.description}>
                {presentation.description}
              </p>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-text-secondary">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                    {local.views}
                  </span>
                  
                  <button
                    onClick={(e) => handleLikeClick(e, presentation)}
                    className={`flex items-center transition-colors ${
                      local.isLiked ? 'text-red-500' : 'text-text-secondary hover:text-red-500'
                    }`}
                    title={local.isLiked ? 'Unlike' : 'Like'}
                  >
                    <svg 
                      className={`w-4 h-4 ${local.isLiked ? 'fill-current' : ''}`} 
                      fill={local.isLiked ? 'currentColor' : 'none'} 
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </button>
                  <span className="ml-1">
                      {local.likes}
                    </span>
                </div>
                
                <span className="text-xs">
                  {new Date(presentation.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Tags */}
              {presentation.tags && presentation.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {presentation.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-secondary text-text-secondary text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {presentation.tags.length > 3 && (
                    <span className="px-2 py-1 bg-secondary text-text-secondary text-xs rounded">
                      +{presentation.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })}
    </div>
    </>
  );
};

export default PresentationGrid;
