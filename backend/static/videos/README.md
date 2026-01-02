# Training Videos Directory

## How to Add Your Training Video

1. **Name your video file**: `pulse-training.mp4`
   - Supported formats: `.mp4`, `.mov`, `.webm`
   - Recommended: MP4 format for best browser compatibility

2. **Place the video file in this directory**:
   ```
   backend/static/videos/pulse-training.mp4
   ```

3. **File size considerations**:
   - Try to keep the video under 100MB for faster loading
   - Consider compressing the video if it's too large
   - You can use tools like HandBrake to compress videos

4. **After adding the video**:
   - Commit the changes: `git add backend/static/videos/pulse-training.mp4`
   - Commit: `git commit -m "Add Pulse training video"`
   - Push to Railway: `git push origin main`

## Video will be accessible at:
- Local: `http://localhost:5002/videos/pulse-training.mp4`
- Production: `https://your-railway-url/videos/pulse-training.mp4`

## Tips for Video Optimization:
- Use H.264 codec for maximum compatibility
- Resolution: 1920x1080 (1080p) or 1280x720 (720p)
- Frame rate: 30fps or 24fps
- Bitrate: 5-8 Mbps for 1080p, 2-4 Mbps for 720p

## Adding Multiple Videos (Optional):
If you want to add more training videos in the future:
1. Add them to this directory with descriptive names
2. Update the frontend link in `frontend/src/pages/Landing.jsx`
3. The video serving endpoint supports any filename: `/videos/<your-video-name>.mp4`

