// client/src/components/DeathSaveModal.jsx
import { useState } from 'react';
import { socket } from '../socket';
import soundSynthesizer from '../utils/SoundSynthesizer';

export default function DeathSaveModal({ tokenId, tokenName, onClose }) {
    const [step, setStep] = useState('prompt'); // 'prompt', 'rolling', 'result'
    const [rollResult, setRollResult] = useState(null);
    const [manualRoll, setManualRoll] = useState('');
    const [success, setSuccess] = useState(null);

    const handleAutoRoll = () => {
        soundSynthesizer.playDiceRoll();
        const roll = Math.floor(Math.random() * 20) + 1;
        const isSuccess = roll >= 10;
        setRollResult(roll);
        setSuccess(isSuccess);
        setStep('result');
        // Send to server after short delay
        setTimeout(() => {
            socket.emit('death_save_roll', { tokenId, roll, success: isSuccess, manual: false });
            onClose();
        }, 1200);
    };

    const handleManualSubmit = () => {
        const val = parseInt(manualRoll);
        if (!isNaN(val) && val >= 1 && val <= 20) {
            const isSuccess = val >= 10;
            setRollResult(val);
            setSuccess(isSuccess);
            setStep('result');
            setTimeout(() => {
                socket.emit('death_save_roll', { tokenId, roll: val, success: isSuccess, manual: true });
                onClose();
            }, 1200);
        } else {
            alert('Enter a number between 1 and 20.');
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] bg-black bg-opacity-70 flex items-center justify-center p-4">
            <div className="bg-bgPanel border border-accentGold rounded-xl p-6 max-w-md w-full shadow-2xl">
                <h2 className="text-accentGold font-bold text-lg mb-2">💀 Death Save</h2>
                <p className="text-textLight text-sm mb-4">
                    {tokenName} is at 0 HP. Roll a death saving throw!
                </p>

                {step === 'prompt' && (
                    <div className="space-y-4">
                        <button
                            className="w-full bg-accentGold text-black font-bold py-2 rounded text-sm hover:bg-yellow-500 transition-colors"
                            onClick={handleAutoRoll}
                        >
                            🎲 Auto-Roll d20
                        </button>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={manualRoll}
                                onChange={(e) => setManualRoll(e.target.value)}
                                placeholder="Manual"
                                className="flex-1 bg-bgCard text-white border border-borderDark rounded p-1 text-center"
                            />
                            <button
                                className="bg-borderDark text-white px-4 py-1 rounded text-sm hover:bg-gray-700"
                                onClick={handleManualSubmit}
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                )}

                {step === 'result' && (
                    <div className="text-center">
                        <p className="text-3xl font-bold mb-2">{rollResult}</p>
                        <p className={`text-lg font-bold ${success ? 'text-green-400' : 'text-red-400'}`}>
                            {success ? '✅ Success!' : '❌ Failure!'}
                        </p>
                        <p className="text-textMuted text-xs mt-2">Sending result...</p>
                    </div>
                )}

                <button
                    className="mt-4 w-full text-textMuted text-xs underline"
                    onClick={onClose}
                >
                    Skip (DM discretion)
                </button>
            </div>
        </div>
    );
}