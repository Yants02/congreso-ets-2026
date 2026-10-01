
interface VideoIframeProps {
    videoUrl : string;
    videoTitle : string;
}

const VideoIframe = ({videoUrl, videoTitle}: VideoIframeProps)  => {
    return(
        <iframe
            className="aspect-video w-full rounded-lg"
            src={videoUrl}
            title={videoTitle}
            allowFullScreen/>
    )
}

export default VideoIframe