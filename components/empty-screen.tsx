import { Button } from '@/components/ui/button'
import { BarChart3, Brain, Car, ChevronRight, FileText } from 'lucide-react'

const exampleMessages = [
  {
    heading: 'DeepSeek R1是什么？',
    message: 'DeepSeek R1是什么？',
    icon: Brain
  },
  {
    heading: '为什么英伟达增长如此迅速？',
    message: '为什么英伟达增长如此迅速？',
    icon: BarChart3
  },
  {
    heading: '特斯拉与Rivian比较',
    message: '特斯拉与Rivian比较',
    icon: Car
  },
  {
    heading: '总结这篇论文: https://arxiv.org/pdf/2501.05707',
    message: '总结这篇论文: https://arxiv.org/pdf/2501.05707',
    icon: FileText
  }
]
export function EmptyScreen({
  submitMessage,
  className
}: {
  submitMessage: (message: string) => void
  className?: string
}) {
  return (
    <div className={`mx-auto w-full transition-all ${className}`}>
      <div className="bg-background p-2">
        <div className="mt-2 flex flex-col items-start space-y-2 mb-4">
          {exampleMessages.map((message, index) => {
            const Icon = message.icon || ChevronRight;
            return (
              <Button
                key={index}
                variant="link"
                className="h-auto p-0 text-base"
                name={message.message}
                onClick={async () => {
                  submitMessage(message.message)
                }}
              >
                <Icon size={16} className="mr-2 text-muted-foreground" />
                {message.heading}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  )
}
