import { useEffect, useRef, useState, useCallback } from "react";
import { TrainingMetric, TrainingSample, CheckpointItem, DatasetCacheProgress } from "../types/training";

export function useTrainingWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<TrainingMetric[]>([]);
  const [samples, setSamples] = useState<TrainingSample[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
  const [currentStatus, setCurrentStatus] = useState<"idle" | "running" | "paused" | "completed" | "error">("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(1000);
  const [cacheProgress, setCacheProgress] = useState<DatasetCacheProgress | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/metrics`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMountedRef.current) setIsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "state") {
            const state = data.state;
            setCurrentStatus(state.status);
            setCurrentStep(state.current_step);
            setTotalSteps(state.total_steps);
            if (state.history) setMetrics(state.history);
            if (state.samples) setSamples(state.samples);
            if (state.checkpoints) setCheckpoints(state.checkpoints);
          } else if (data.type === "metric") {
            setMetrics((prev) => [...prev.slice(-150), data.metric]);
            if (data.state) {
              setCurrentStep(data.state.current_step);
              setTotalSteps(data.state.total_steps);
              setCurrentStatus(data.state.status);
            }
          } else if (data.type === "sample") {
            setSamples((prev) => [data.sample, ...prev]);
          } else if (data.type === "checkpoint") {
            setCheckpoints((prev) => [data.checkpoint, ...prev]);
          } else if (data.type === "status") {
            setCurrentStatus(data.status || (data.state && data.state.status));
          } else if (data.type === "cache_progress") {
            setCacheProgress(data.cache_progress);
          }
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      };

      ws.onclose = () => {
        if (isMountedRef.current) {
          setIsConnected(false);
          // Auto reconnect after 2s
          setTimeout(() => {
            if (isMountedRef.current) connect();
          }, 2000);
        }
      };

      ws.onerror = () => {
        if (isMountedRef.current) setIsConnected(false);
      };
    } catch (e) {
      console.error("Failed to connect to WS:", e);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connect();
    return () => {
      isMountedRef.current = false;
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        } else if (wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.onopen = function () {
            this.close();
          };
        }
      }
    };
  }, [connect]);

  return {
    isConnected,
    metrics,
    samples,
    checkpoints,
    currentStatus,
    currentStep,
    totalSteps,
    cacheProgress,
    setCacheProgress,
    setMetrics,
    setSamples,
    setCheckpoints,
    setCurrentStatus
  };
}
