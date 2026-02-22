import { useState } from "react";
import GameScreen from "@/components/game/GameScreen";
import StartScreen from "@/components/game/StartScreen";
import GameOverScreen from "@/components/game/GameOverScreen";

const Index = () => {
  const [gameState, setGameState] = useState<"start" | "playing" | "gameOver">("start");
  const [score, setScore] = useState(0);

  const handleStart = () => {
    setGameState("playing");
    setScore(0);
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setGameState("gameOver");
  };

  const handleRestart = () => {
    setGameState("playing");
    setScore(0);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-blood-vessel">
      {gameState === "start" && <StartScreen onStart={handleStart} />}
      {gameState === "playing" && <GameScreen onGameOver={handleGameOver} />}
      {gameState === "gameOver" && (
        <GameOverScreen score={score} onRestart={handleRestart} />
      )}
    </div>
  );
};

export default Index;
