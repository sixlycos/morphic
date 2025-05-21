'use client'

import { getCookie, setCookie } from '@/lib/utils/cookies'
import { AlertTriangle, BookOpen, Check, ChevronsUpDown, FileText, Map, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

// Tool interface definition
export interface Tool {
    id: string
    name: string
    category: string
    description?: string
    icon?: React.ReactNode
    color?: string
}

// Default tools available in the system
const defaultTools: Tool[] = [
    {
        id: 'research_report',
        name: '一键研报生成',
        category: '金融分析',
        description: '自动生成投资研报',
        icon: <FileText className="h-4 w-4 text-blue-500" />,
        color: 'bg-blue-100'
    },
    {
        id: 'financial_alert',
        name: '财务异常预警器',
        category: '金融分析',
        description: '监控关键指标异动',
        icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
        color: 'bg-red-100'
    },
    {
        id: 'industry_risk_map',
        name: '产业链传染风险地图',
        category: '金融分析',
        description: '可视化显示上下游风险传导',
        icon: <Map className="h-4 w-4 text-green-500" />,
        color: 'bg-green-100'
    },
    {
        id: 'regulatory_intent',
        name: '监管意图解读器',
        category: '合规增强',
        description: '解读证监会/交易所监管问询高频词',
        icon: <BookOpen className="h-4 w-4 text-purple-500" />,
        color: 'bg-purple-100'
    }
]

function groupToolsByCategory(tools: Tool[]) {
    return tools.reduce((groups, tool) => {
        const category = tool.category
        if (!groups[category]) {
            groups[category] = []
        }
        groups[category].push(tool)
        return groups
    }, {} as Record<string, Tool[]>)
}

interface ToolsSelectorProps {
    tools?: Tool[]
}

export function ToolsSelector({ tools = defaultTools }: ToolsSelectorProps) {
    const [open, setOpen] = useState(false)
    const [selectedTools, setSelectedTools] = useState<string[]>([])

    useEffect(() => {
        const savedTools = getCookie('selectedTools')
        if (savedTools) {
            try {
                const parsedTools = JSON.parse(savedTools) as string[]
                // 过滤掉已删除的工具
                const validTools = parsedTools.filter(id =>
                    defaultTools.some(tool => tool.id === id)
                )

                setSelectedTools(validTools)

                // 如果没有工具被选中，默认选择研报工具
                if (validTools.length === 0) {
                    const defaultSelected = ['research_report']
                    setSelectedTools(defaultSelected)
                    setCookie('selectedTools', JSON.stringify(defaultSelected))
                    console.log('默认选择工具:', defaultSelected)
                }
            } catch (e) {
                console.error('Failed to parse saved tools:', e)
                // 默认选择研报工具
                const defaultSelected = ['research_report']
                setSelectedTools(defaultSelected)
                setCookie('selectedTools', JSON.stringify(defaultSelected))
                console.log('解析失败，默认选择工具:', defaultSelected)
            }
        } else {
            // 默认选择研报工具
            const defaultSelected = ['research_report']
            setSelectedTools(defaultSelected)
            setCookie('selectedTools', JSON.stringify(defaultSelected))
            console.log('无保存工具，默认选择:', defaultSelected)
        }
    }, [])

    const handleToolToggle = (id: string) => {
        setSelectedTools(prev => {
            // 如果已经选中，则移除
            if (prev.includes(id)) {
                const newSelection = prev.filter(toolId => toolId !== id)
                setCookie('selectedTools', JSON.stringify(newSelection))
                console.log('工具已移除:', id, '当前工具:', newSelection)
                return newSelection
            }
            // 添加新工具到选择
            const newSelection = [...prev, id]
            setCookie('selectedTools', JSON.stringify(newSelection))
            console.log('工具已添加:', id, '当前工具:', newSelection)
            return newSelection
        })
    }

    const getSelectedToolsDisplay = () => {
        if (selectedTools.length === 0) return '选择工具'

        if (selectedTools.length <= 2) {
            // 如果只有1-2个工具，显示完整标签
            return (
                <div className="flex flex-wrap gap-1">
                    {selectedTools.map(id => {
                        const tool = tools.find(tool => tool.id === id)
                        if (!tool) return null
                        return (
                            <span key={id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${tool.color} whitespace-nowrap`}>
                                {tool.name}
                            </span>
                        )
                    }).filter(Boolean)}
                </div>
            )
        } else {
            // 如果超过2个工具，只显示数量
            return `已选${selectedTools.length}个工具`
        }
    }

    const groupedTools = groupToolsByCategory(tools)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="text-sm rounded-full shadow-none focus:ring-0 min-h-[32px] h-auto px-3 py-1"
                >
                    <div className="flex items-center">
                        <Wrench className="h-4 w-4 text-orange-500 mr-1.5 flex-shrink-0" />
                        <div className="truncate max-w-[150px]">
                            {getSelectedToolsDisplay()}
                        </div>
                        <ChevronsUpDown className="ml-1.5 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
                <Command>
                    <CommandInput placeholder="搜索工具..." />
                    <CommandList>
                        <CommandEmpty>未找到工具。</CommandEmpty>
                        {Object.entries(groupedTools).map(([category, categoryTools]) => (
                            <CommandGroup key={category} heading={category}>
                                {categoryTools.map(tool => (
                                    <CommandItem
                                        key={tool.id}
                                        value={tool.id}
                                        onSelect={() => handleToolToggle(tool.id)}
                                        className={`flex justify-between ${selectedTools.includes(tool.id) ? tool.color || '' : ''}`}
                                    >
                                        <div className="flex items-center space-x-2">
                                            {tool.icon || <Wrench className="h-4 w-4 text-orange-500 mr-1" />}
                                            <span className="text-xs font-medium">
                                                {tool.name}
                                            </span>
                                        </div>
                                        <div className={`h-5 w-5 rounded-full flex items-center justify-center ${selectedTools.includes(tool.id)
                                            ? 'bg-primary'
                                            : 'border-2 border-gray-300'
                                            }`}>
                                            {selectedTools.includes(tool.id) && (
                                                <Check className="h-3 w-3 text-white" />
                                            )}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
} 