"use client";

import { AnimatePresence, motion } from 'framer-motion';
import { BrainCircuit, Search, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface AIWorkflowProps {
    trigger?: string;
    onComplete?: (result: any) => void;
    displayMode?: 'fixed' | 'inline';
}

const AIWorkflow: React.FC<AIWorkflowProps> = ({
    trigger,
    onComplete,
    displayMode = 'fixed'
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [thinking, setThinking] = useState(false);

    const workflowSteps = [
        {
            id: 'input',
            title: '输入分析',
            description: '正在分析您的需求...',
            icon: Search
        },
        {
            id: 'processing',
            title: '智能处理',
            description: '使用AI模型进行推理...',
            icon: BrainCircuit
        },
        {
            id: 'output',
            title: '生成结果',
            description: '正在整合分析结果...',
            icon: Sparkles
        }
    ];

    useEffect(() => {
        if (trigger === '工作流测试') {
            setIsVisible(true);
            simulateWorkflow();
        }
    }, [trigger]);

    const simulateWorkflow = async () => {
        setIsVisible(true);

        // 模拟工作流程
        for (let i = 0; i < workflowSteps.length; i++) {
            setCurrentStep(i);
            setThinking(true);
            await new Promise(resolve => setTimeout(resolve, 2000));
            setThinking(false);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 完成后的回调
        if (onComplete) {
            onComplete({
                status: 'success',
                message: '工作流程已完成'
            });
        }

        // 重置状态
        setTimeout(() => {
            setIsVisible(false);
            setCurrentStep(0);
        }, 1000);
    };

    // 根据显示模式决定容器类名
    const containerClassName = displayMode === 'fixed'
        ? "fixed bottom-4 right-4 bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 w-96 border border-border"
        : "w-full h-full bg-white dark:bg-gray-900 rounded-lg p-6 flex flex-col justify-center items-center border border-border";

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={containerClassName}
                >
                    <div className="w-full">
                        <h2 className="text-lg font-medium mb-4 text-center flex items-center justify-center gap-2">
                            <Sparkles className="h-5 w-5 text-blue-500" />
                            <span>AI 工作流</span>
                        </h2>

                        <div className="space-y-6 w-full">
                            {workflowSteps.map((step, index) => {
                                const StepIcon = step.icon;
                                const isActive = currentStep === index;
                                const isPast = currentStep > index;
                                const isFuture = currentStep < index;

                                return (
                                    <motion.div
                                        key={step.id}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{
                                            x: 0,
                                            opacity: isActive || isPast ? 1 : 0.5
                                        }}
                                        className={`relative ${index < workflowSteps.length - 1 ? 'pb-6' : ''
                                            }`}
                                    >
                                        {/* 连接线 */}
                                        {index < workflowSteps.length - 1 && (
                                            <div className="absolute left-4 top-8 w-0.5 h-full bg-gray-200 dark:bg-gray-700 -ml-0.5 z-0"></div>
                                        )}

                                        <div className={`flex items-start gap-4 relative z-10 ${isActive ? 'text-blue-500' :
                                            isPast ? 'text-green-500' :
                                                'text-gray-400'
                                            }`}>
                                            <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${isActive ? 'bg-blue-100 dark:bg-blue-900 text-blue-500' :
                                                isPast ? 'bg-green-100 dark:bg-green-900 text-green-500' :
                                                    'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                                }`}>
                                                {isPast ? (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="text-green-500"
                                                    >
                                                        ✓
                                                    </motion.div>
                                                ) : (
                                                    <StepIcon className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className={`font-medium ${isActive ? 'text-blue-500' :
                                                    isPast ? 'text-green-500' :
                                                        'text-gray-600 dark:text-gray-400'
                                                    }`}>
                                                    {step.title}
                                                </h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    {step.description}
                                                </p>
                                            </div>
                                            {isActive && thinking && (
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                    className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
                                                />
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AIWorkflow; 