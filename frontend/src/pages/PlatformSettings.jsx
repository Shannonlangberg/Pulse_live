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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/users')}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Admin Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">Platform Settings</h1>
          <p className="text-white/60">Manage training videos and platform resources</p>
        </div>

        {/* Training Video Section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <VideoCameraIcon className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Training Video</h2>
              <p className="text-sm text-white/60">Upload a video to help users learn how to use Pulse</p>
            </div>
          </div>

          {/* Current Video Status */}
          {currentVideo && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-400 mb-1">Training video is active</p>
                  <p className="text-xs text-white/60">
                    Uploaded: {new Date(currentVideo.uploaded_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-white/60">
                    Size: {formatFileSize(currentVideo.file_size)}
                  </p>
                  <a
                    href="/videos/pulse-training.mp4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    View current video →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Upload Status Messages */}
          {uploadStatus === 'success' && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-400">{uploadMessage}</p>
                </div>
              </div>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <ExclamationCircleIcon className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">{uploadMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* File Upload */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                {currentVideo ? 'Replace Training Video' : 'Upload Training Video'}
              </label>
              <input
                id="video-upload"
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleFileSelect}
                disabled={uploading}
                className="block w-full text-sm text-white/60
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-emerald-500/20 file:text-emerald-400
                  hover:file:bg-emerald-500/30
                  file:transition-colors
                  file:cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="mt-2 text-xs text-white/40">
                Accepted formats: MP4, MOV, WebM • Maximum size: 500MB
              </p>
              {videoFile && (
                <p className="mt-2 text-sm text-white/80">
                  Selected: <span className="font-medium">{videoFile.name}</span> ({formatFileSize(videoFile.size)})
                </p>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!videoFile || uploading}
              className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-white/10 
                text-white font-semibold rounded-lg transition-all duration-200 
                disabled:cursor-not-allowed disabled:text-white/40
                flex items-center justify-center gap-2"
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
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">💡 Tips for Best Results</h3>
            <ul className="text-xs text-white/60 space-y-1">
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

