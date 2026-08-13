import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, VideoCameraIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

const PlatformSettings = () => {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', or null
  const [uploadMessage, setUploadMessage] = useState('');
  const [currentVideo, setCurrentVideo] = useState(null);
  const [videoFile, setVideoFile] = useState(null);

  useEffect(() => {
    checkExistingVideo();
  }, []);

  const checkExistingVideo = async () => {
    try {
      const response = await fetch('/api/platform-settings/training-video', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentVideo(data);
      }
    } catch (error) {
      console.error('Error checking for existing video:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file type
      const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
      if (!validTypes.includes(file.type)) {
        setUploadStatus('error');
        setUploadMessage('Please upload a video file (MP4, MOV, or WebM)');
        return;
      }

      // Check file size (max 500MB)
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (file.size > maxSize) {
        setUploadStatus('error');
        setUploadMessage('Video file is too large. Maximum size is 500MB. Please compress your video first.');
        return;
      }

      setVideoFile(file);
      setUploadStatus(null);
      setUploadMessage('');
    }
  };

  const handleUpload = async () => {
    if (!videoFile) {
      setUploadStatus('error');
      setUploadMessage('Please select a video file first');
      return;
    }

    setUploading(true);
    setUploadStatus(null);
    setUploadMessage('');

    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch('/api/platform-settings/training-video/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus('success');
        setUploadMessage('Training video uploaded successfully! It will appear on the homepage.');
        setVideoFile(null);
        // Clear the file input
        const fileInput = document.getElementById('video-upload');
        if (fileInput) fileInput.value = '';
        // Refresh video info
        setTimeout(() => checkExistingVideo(), 1000);
      } else {
        setUploadStatus('error');
        setUploadMessage(data.error || 'Failed to upload video');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setUploadMessage('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-fc-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/users')}
            className="inline-flex items-center gap-2 text-fc-brown hover:text-fc-midnight transition-colors mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Admin Dashboard
          </button>
          <p className="fc-label mb-2">Platform</p>
          <h1 className="fc-display fc-display-md text-fc-midnight">Platform Settings</h1>
          <p className="text-fc-brown mt-1">Manage training videos and platform resources</p>
        </div>

        {/* Training Video Section */}
        <div className="fc-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-fc-wash-mint flex items-center justify-center">
              <VideoCameraIcon className="h-6 w-6 text-fc-olive" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-fc-midnight">Training Video</h2>
              <p className="text-sm text-fc-brown">Upload a video to help users learn how to use Pulse</p>
            </div>
          </div>

          {/* Current Video Status */}
          {currentVideo && (
            <div className="mb-6 p-4 bg-fc-wash-mint border border-fc-wash-mint-border rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="h-5 w-5 text-fc-olive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-fc-midnight mb-1">Training video is active</p>
                  <p className="text-xs text-fc-brown">
                    Uploaded: {new Date(currentVideo.uploaded_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-fc-brown">
                    Size: {formatFileSize(currentVideo.file_size)}
                  </p>
                  <a
                    href="/videos/pulse-training.mp4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-fc-olive hover:underline transition-colors"
                  >
                    View current video →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Upload Status Messages */}
          {uploadStatus === 'success' && (
            <div className="mb-6 p-4 bg-fc-wash-mint border border-fc-wash-mint-border rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="h-5 w-5 text-fc-olive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-fc-midnight">{uploadMessage}</p>
                </div>
              </div>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="mb-6 p-4 bg-fc-wash-peach border border-fc-wash-peach-border rounded-lg">
              <div className="flex items-start gap-3">
                <ExclamationCircleIcon className="h-5 w-5 text-fc-copper flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-fc-copper">{uploadMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* File Upload */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fc-midnight mb-2">
                {currentVideo ? 'Replace Training Video' : 'Upload Training Video'}
              </label>
              <input
                id="video-upload"
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleFileSelect}
                disabled={uploading}
                className="block w-full text-sm text-fc-brown
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-fc-wash-mint file:text-fc-olive
                  hover:file:bg-fc-wash-mint
                  file:transition-colors
                  file:cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="mt-2 text-xs text-fc-brown/70">
                Accepted formats: MP4, MOV, WebM • Maximum size: 500MB
              </p>
              {videoFile && (
                <p className="mt-2 text-sm text-fc-midnight">
                  Selected: <span className="font-medium">{videoFile.name}</span> ({formatFileSize(videoFile.size)})
                </p>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!videoFile || uploading}
              className="fc-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <VideoCameraIcon className="h-5 w-5" />
                  Upload Video
                </>
              )}
            </button>
          </div>

          {/* Tips */}
          <div className="mt-6 p-4 bg-fc-wash-sky border border-fc-wash-sky-border rounded-lg">
            <h3 className="text-sm font-semibold text-fc-teal mb-2">💡 Tips for Best Results</h3>
            <ul className="text-xs text-fc-brown space-y-1">
              <li>• Keep your video under 100MB for faster loading</li>
              <li>• Use MP4 format with H.264 codec for maximum compatibility</li>
              <li>• Recommended resolution: 1920x1080 (1080p) or 1280x720 (720p)</li>
              <li>• Consider adding captions or subtitles to your video</li>
              <li>• Test the video playback after uploading</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformSettings;
