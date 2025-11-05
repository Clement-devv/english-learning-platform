// src/components/EmojiReactions.jsx - Fun emoji reactions for children
import React, { useState, useEffect } from 'react';
import { Smile } from 'lucide-react';

const emojis = [
  { emoji: '👍', name: 'Thumbs Up', color: '#FFD700' },
  { emoji: '❤️', name: 'Heart', color: '#FF6B9D' },
  { emoji: '🌸', name: 'Flower', color: '#FFB6C1' },
  { emoji: '⭐', name: 'Star', color: '#FFD700' },
  { emoji: '🎉', name: 'Party', color: '#FF6347' },
  { emoji: '😊', name: 'Happy', color: '#FFA500' },
  { emoji: '🌈', name: 'Rainbow', color: '#87CEEB' },
  { emoji: '🦋', name: 'Butterfly', color: '#DDA0DD' },
  { emoji: '✨', name: 'Sparkles', color: '#FFD700' },
  { emoji: '🌟', name: 'Shining Star', color: '#FFD700' },
];

export default function EmojiReactions() {
  const [showPicker, setShowPicker] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  useEffect(() => {
    // Clean up old emojis
    const interval = setInterval(() => {
      setFloatingEmojis(prev => prev.filter(e => Date.now() - e.timestamp < 3000));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const sendEmoji = (emoji) => {
    const id = Date.now() + Math.random();
    const newEmoji = {
      id,
      emoji: emoji.emoji,
      timestamp: Date.now(),
      x: Math.random() * 80 + 10, // Random X position (10-90%)
      color: emoji.color
    };

    setFloatingEmojis(prev => [...prev, newEmoji]);
    setShowPicker(false);

    // You can add socket.io here to broadcast to other users
    // socket.emit('emoji-reaction', { emoji: emoji.emoji });
  };

  return (
    <div className="relative">
      {/* Floating Emojis */}
      <div className="fixed inset-0 pointer-events-none z-50">
        {floatingEmojis.map((item) => (
          <div
            key={item.id}
            className="absolute animate-float-up"
            style={{
              left: `${item.x}%`,
              bottom: '10%',
              fontSize: '3rem',
              animation: 'floatUp 3s ease-out forwards',
            }}
          >
            {item.emoji}
          </div>
        ))}
      </div>

      {/* Emoji Button */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 animate-bounce-slow"
        title="Send Emoji"
      >
        <Smile className="w-6 h-6" />
      </button>

      {/* Emoji Picker */}
      {showPicker && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-2xl p-4 z-50 border-4 border-purple-400">
            <h3 className="text-lg font-bold text-center mb-3 text-purple-600">
              Choose an Emoji! 🎨
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {emojis.map((emojiItem, index) => (
                <button
                  key={index}
                  onClick={() => sendEmoji(emojiItem)}
                  className="text-4xl p-2 hover:scale-125 transition-transform hover:bg-purple-100 rounded-xl"
                  title={emojiItem.name}
                  style={{
                    animation: `popIn 0.3s ease-out ${index * 0.05}s both`
                  }}
                >
                  {emojiItem.emoji}
                </button>
              ))}
            </div>
            <p className="text-xs text-center mt-3 text-gray-500">
              Click to send! 🚀
            </p>
          </div>
        </>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          50% {
            transform: translateY(-200px) scale(1.2);
            opacity: 1;
          }
          100% {
            transform: translateY(-400px) scale(0.8);
            opacity: 0;
          }
        }

        @keyframes popIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-bounce-slow {
          animation: bounce 2s infinite;
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
}
