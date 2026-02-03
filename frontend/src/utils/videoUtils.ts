/**
 * Format video duration from seconds to a readable time string
 * @param durationInSeconds - Duration in seconds (can be a decimal)
 * @returns Formatted time string (e.g., "3:57" or "1:23:45")
 */
export const formatVideoDuration = (durationInSeconds: number): string => {
  if (!durationInSeconds || durationInSeconds <= 0) {
    return '0:00';
  }

  // Round to nearest integer to avoid decimal places
  const totalSeconds = Math.round(durationInSeconds);
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    // Format: H:MM:SS
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    // Format: M:SS
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};

