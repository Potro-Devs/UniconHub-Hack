import { useEffect, useRef, useState } from 'react';
import { alertBox, buttonStyle, card, mutedText, noticeBox } from '@/shared/styles/ui';
import { computeCoverGuideRect, scanOmrImage } from './omr.scanner';

const MAX_SCAN_DIM = 1400;

function imageDataFromCanvasSource(source, sourceWidth, sourceHeight) {
  const scale = Math.min(1, MAX_SCAN_DIM / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  canvas.width = 0;
  canvas.height = 0;
  return { imageData, width, height, scale };
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No pudimos abrir esa foto.'));
    };
    img.src = url;
  });
}

export function OmrScannerPanel({ layout, studentLabel, onApplyScan, onClose }) {
  const videoRef = useRef(null);
  const viewportRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraState, setCameraState] = useState('starting'); // starting | ready | unavailable
  const [feedback, setFeedback] = useState({ error: '', info: '' });
  const [processing, setProcessing] = useState(false);

  const stopStream = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    let active = true;
    async function startCamera() {
      if (!navigator?.mediaDevices?.getUserMedia) {
        if (active) {
          setCameraState('unavailable');
          setFeedback({
            error: '',
            info: 'Tu navegador no permite abrir la cámara en directo aquí. Puedes tomar o elegir una foto o capturar a mano.',
          });
        }
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        if (active) setCameraState('ready');
      } catch {
        if (active) {
          setCameraState('unavailable');
          setFeedback({
            error: 'No pudimos acceder a la cámara trasera.',
            info: 'Revisa los permisos de la cámara, toma una foto desde archivo o continúa con la captura manual.',
          });
        }
      }
    }
    startCamera();
    return () => {
      active = false;
      stopStream();
    };
  }, []);

  const processResult = (result) => {
    if (!result.ok) {
      setFeedback({ error: result.message, info: '' });
      return;
    }
    stopStream();
    onApplyScan(result);
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    const viewport = viewportRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || processing) return;
    setProcessing(true);
    setFeedback({ error: '', info: '' });
    try {
      const { imageData, width, height } = imageDataFromCanvasSource(video, video.videoWidth, video.videoHeight);
      const guideRect = viewport
        ? computeCoverGuideRect(width, height, viewport.clientWidth, viewport.clientHeight)
        : null;
      const result = scanOmrImage(imageData, layout, { guideRect });
      processResult(result);
    } catch {
      setFeedback({ error: 'No pudimos procesar la foto de la hoja. Intenta con más luz.', info: '' });
    } finally {
      setProcessing(false);
    }
  };

  const handlePhotoFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || processing) return;
    setProcessing(true);
    setFeedback({ error: '', info: '' });
    try {
      const img = await loadImageFile(file);
      const { imageData } = imageDataFromCanvasSource(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
      const result = scanOmrImage(imageData, layout, { guideRect: null });
      processResult(result);
    } catch {
      setFeedback({ error: 'No pudimos leer esa fotografía. Asegúrate de que sea una foto clara de la hoja.', info: '' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section style={card} className="omr-scanner" aria-label="Escáner de hoja de respuestas">
      <div className="omr-scanner-header">
        <div>
          <h3 className="font-display" style={{ margin: 0, fontSize: '19px' }}>Escanear hoja · {studentLabel}</h3>
          <p style={{ ...mutedText, margin: '4px 0 0' }}>
            Alinea los 4 cuadros negros de la hoja dentro del marco guía. La foto se procesa solo en este dispositivo y no se guarda.
          </p>
        </div>
        <span className="omr-code-pill">Código {layout.code}</span>
      </div>

      {cameraState !== 'unavailable' && (
        <div ref={viewportRef} className="omr-viewport">
          <video ref={videoRef} className="omr-video" playsInline muted autoPlay />
          <div className="omr-guide" aria-hidden="true">
            <span className="omr-corner omr-corner--tl" />
            <span className="omr-corner omr-corner--tr" />
            <span className="omr-corner omr-corner--br" />
            <span className="omr-corner omr-corner--bl" />
          </div>
          {cameraState === 'starting' && <p className="omr-viewport-status">Abriendo cámara trasera…</p>}
        </div>
      )}

      {feedback.info && <p role="status" style={{ ...noticeBox, margin: 0 }}>{feedback.info}</p>}
      {feedback.error && <p role="alert" style={{ ...alertBox, margin: 0 }}>{feedback.error}</p>}

      <div className="paper-actions">
        {cameraState === 'ready' && (
          <button
            type="button"
            disabled={processing}
            style={buttonStyle('primary', { disabled: processing })}
            onClick={captureFromVideo}
          >
            {processing ? 'Leyendo burbujas…' : 'Tomar foto y leer'}
          </button>
        )}
        <label className="omr-upload-label" style={buttonStyle(cameraState === 'ready' ? 'secondary' : 'primary', { disabled: processing })}>
          <span>{processing ? 'Procesando…' : 'Elegir o tomar foto'}</span>
          <input type="file" accept="image/*" capture="environment" disabled={processing} onChange={handlePhotoFile} />
        </label>
        <button
          type="button"
          style={buttonStyle('ghost')}
          onClick={() => {
            stopStream();
            onClose();
          }}
        >
          Capturar a mano
        </button>
      </div>
    </section>
  );
}
