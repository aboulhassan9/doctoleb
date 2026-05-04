import { useRef, useCallback } from 'react';

/**
 * Reusable signature pad hook.
 * Extracts the identical canvas drawing logic from
 * DoctorCertificatesPage and DoctorReferralsPage.
 *
 * Usage:
 *   const { canvasRef, startDraw, draw, stopDraw, clearSignature } = useSignaturePad();
 */
export function useSignaturePad() {
    const canvasRef = useRef(null);
    const isDrawing = useRef(false);

    const getPos = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    const startDraw = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        e.preventDefault();
        isDrawing.current = true;
        const ctx = canvas.getContext('2d');
        const { x, y } = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(x, y);
    }, []);

    const draw = useCallback((e) => {
        if (!isDrawing.current) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const { x, y } = getPos(e, canvas);
        ctx.lineTo(x, y);
        ctx.stroke();
    }, []);

    const stopDraw = useCallback(() => {
        isDrawing.current = false;
    }, []);

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };

    return { canvasRef, startDraw, draw, stopDraw, clearSignature };
}
