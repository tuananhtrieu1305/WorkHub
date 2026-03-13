import { useEffect, useRef } from "react";


const AuthFormBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let time = 0;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    
    const blobs = [
      {
        
        color: { r: 168, g: 85, b: 247 }, 
        baseX: 0.8, baseY: 0.15, 
        radiusX: 0.25, radiusY: 0.15,
        size: 0.75, 
        speed: 0.0001,
        phase: 0,
      },
      {
        
        color: { r: 249, g: 115, b: 22 }, 
        baseX: 0.7, baseY: 0.5,
        radiusX: 0.15, radiusY: 0.2,
        size: 0.65,
        speed: 0.00012,
        phase: Math.PI,
      },
      {
        
        color: { r: 236, g: 72, b: 153 }, 
        baseX: 0.9, baseY: 0.35,
        radiusX: 0.15, radiusY: 0.25,
        size: 0.6,
        speed: 0.00008,
        phase: Math.PI * 0.5,
      },
    ];

    const drawBlob = (blob, t) => {
      const w = canvas.width;
      const h = canvas.height;

      
      const cx = (blob.baseX + Math.sin(t * blob.speed + blob.phase) * blob.radiusX) * w;
      const cy = (blob.baseY + Math.cos(t * blob.speed * 0.8 + blob.phase) * blob.radiusY) * h;

      const radius = blob.size * Math.min(w, h);

      
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(${blob.color.r}, ${blob.color.g}, ${blob.color.b}, 0.25)`);
      gradient.addColorStop(0.5, `rgba(${blob.color.r}, ${blob.color.g}, ${blob.color.b}, 0.08)`);
      gradient.addColorStop(1, `rgba(${blob.color.r}, ${blob.color.g}, ${blob.color.b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    };

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      
      ctx.fillStyle = "#0b0213";
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "screen";
      blobs.forEach((blob) => drawBlob(blob, time));
      ctx.globalCompositeOperation = "source-over";

      
      const fadeGradient = ctx.createLinearGradient(0, 0, w * 0.5, 0);
      fadeGradient.addColorStop(0, "rgba(11, 2, 19, 1)");       
      fadeGradient.addColorStop(0.3, "rgba(11, 2, 19, 0.85)");
      fadeGradient.addColorStop(0.6, "rgba(11, 2, 19, 0.4)");
      fadeGradient.addColorStop(1, "rgba(11, 2, 19, 0)");        
      ctx.fillStyle = fadeGradient;
      ctx.fillRect(0, 0, w * 0.5, h);

      time += 16;
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
};

export default AuthFormBackground;
