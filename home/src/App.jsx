import FaultyTerminal from './components/faulty-terminal';
import FuzzyText from './components/fuzzy-text';

export const App = () => {
    return (
        <div className='w-screen h-screen flex flex-col gap-8 items-center justify-center bg-black overflow-hidden relative'>
            <FaultyTerminal
                className='absolute inset-0'
                tint='#b30092'
                scale={3}
                digitSize={1.5}
                speed={0.5}
                noiseAmp={1}
                brightness={1}
                scanlineIntensity={1}
                curvature={0.1}
                mouseStrength={0.1}
                pageLoadAnimation
                mouseReact
            />

            <div className='relative z-10 font-zenkaku'>
                <FuzzyText fontSize='clamp(2rem, 8vw, 6rem)' baseIntensity={0.1} enableHover>
                    エンドポイント
                </FuzzyText>
            </div>

            <div className='relative z-10 font-bitter italic'>
                <FuzzyText
                    fontSize='clamp(0.5rem, 8vw, 1.5rem)'
                    baseIntensity={0.05}
                    enableHover={false}
                >
                    endpoints.hckr.mx
                </FuzzyText>
            </div>
        </div>
    );
};
