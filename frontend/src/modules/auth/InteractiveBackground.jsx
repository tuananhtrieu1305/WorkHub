import { useEffect, useRef } from "react";

const InteractiveBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas(); 

    const particles = [];
    const numParticles = 80;
    const maxDistance = 150;

    let mouse = { x: -1000, y: -1000 };
    let isMouseOnScreen = false;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      isMouseOnScreen = true;
    };

    const handleMouseLeave = () => {
      // Nhả bung particles
      particles.forEach((p) => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0.1 && distance < 300) {
          const force = (300 - distance) / 300;
          p.vx += (dx / distance) * force * 15;
          p.vy += (dy / distance) * force * 15;
        }
      });

      isMouseOnScreen = false;
      mouse.x = -1000;
      mouse.y = -1000;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.baseVx = (Math.random() - 0.5) * 1.2;
        this.baseVy = (Math.random() - 0.5) * 1.2;
        this.vx = this.baseVx;
        this.vy = this.baseVy;
        this.radius = Math.random() * 2 + 0.5;
        const colors = ["#a855f7", "#d946ef", "#ffffff", "#c084fc"];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        if (isMouseOnScreen) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const interactionRadius = 200;
          const minDistance = 70;

          if (distance < interactionRadius) {
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;

            if (distance > minDistance) {
              const pullForce = (interactionRadius - distance) / interactionRadius;
              this.vx += forceDirectionX * pullForce * 0.4;
              this.vy += forceDirectionY * pullForce * 0.4;
            } else {
              const pushForce = (minDistance - distance) / minDistance;
              this.vx -= forceDirectionX * pushForce * 0.6;
              this.vy -= forceDirectionY * pushForce * 0.6;
            }
          }
        }

        this.vx += (this.baseVx - this.vx) * 0.03;
        this.vy += (this.baseVy - this.vy) * 0.03;

        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0) {
          this.x = 0;
          this.vx *= -1;
          this.baseVx *= -1;
        } else if (this.x > canvas.width) {
          this.x = canvas.width;
          this.vx *= -1;
          this.baseVx *= -1;
        }

        if (this.y < 0) {
          this.y = 0;
          this.vy *= -1;
          this.baseVy *= -1;
        } else if (this.y > canvas.height) {
          this.y = canvas.height;
          this.vy *= -1;
          this.baseVy *= -1;
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.6;
        ctx.fill();
      }
    }

    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
    }

    const drawLines = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            
            const mouseDx = particles[i].x - mouse.x;
            const mouseDy = particles[i].y - mouse.y;
            const mouseDist = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);
            
            let alpha = 1 - distance / maxDistance;
            
            if (isMouseOnScreen && mouseDist < 200) {
                alpha *= 1.5; 
            } else {
                alpha *= 0.25; 
            }

            const grad = ctx.createLinearGradient(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
            grad.addColorStop(0, particles[i].color);
            grad.addColorStop(1, particles[j].color);

            ctx.strokeStyle = grad;
            ctx.globalAlpha = Math.min(alpha, 0.8);
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      drawLines();
      
      ctx.globalAlpha = 1;

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
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
        zIndex: 1, 
        pointerEvents: "auto"
      }}
    />
  );
};

export default InteractiveBackground;
