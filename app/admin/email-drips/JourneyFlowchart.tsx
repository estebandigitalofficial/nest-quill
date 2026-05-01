'use client'

/* ──────────────────────────────────────────────────────────────────
   JourneyFlowchart — visual map of every email touchpoint
   Pure presentation component; nothing is editable here.
   ────────────────────────────────────────────────────────────────── */

type JourneyNode = {
  subject: string
  delay: string
  enabled: boolean
  color: 'green' | 'amber' | 'blue'
}

type Branch = {
  label: string
  nodes: JourneyNode[]
}

type Phase = {
  title: string
  branches: Branch[]
}

const journey: Phase[] = [
  {
    title: 'User Signs Up',
    branches: [
      {
        label: 'Creates a story',
        nodes: [
          { subject: 'Your story is ready to enjoy', delay: '+2d', enabled: true, color: 'green' },
          { subject: 'Ideas for sharing', delay: '+4d', enabled: true, color: 'green' },
          { subject: 'How did they like it?', delay: '+6d', enabled: true, color: 'green' },
        ],
      },
      {
        label: 'No activity (3 days)',
        nodes: [
          { subject: 'Still thinking about it?', delay: '+3d', enabled: true, color: 'amber' },
          { subject: "Here's what families are saying", delay: '+7d', enabled: true, color: 'amber' },
          { subject: 'We miss you at Nest & Quill', delay: '+14d', enabled: true, color: 'amber' },
        ],
      },
      {
        label: 'Uses learning tools',
        nodes: [
          { subject: 'Great start with learning tools!', delay: '+1d', enabled: true, color: 'blue' },
          { subject: 'Keep the learning going', delay: '+5d', enabled: true, color: 'blue' },
        ],
      },
    ],
  },
  {
    title: 'After First Story',
    branches: [
      {
        label: 'Creates 2nd story',
        nodes: [
          { subject: "You're on a roll!", delay: '+1d', enabled: true, color: 'green' },
        ],
      },
      {
        label: 'No activity (7 days)',
        nodes: [
          { subject: 'New story themes just dropped', delay: '+7d', enabled: true, color: 'amber' },
          { subject: 'A special story is waiting', delay: '+14d', enabled: true, color: 'amber' },
        ],
      },
      {
        label: 'Upgrades plan',
        nodes: [
          { subject: 'Welcome to your new plan', delay: '+0d', enabled: true, color: 'blue' },
        ],
      },
    ],
  },
  {
    title: 'Free Trial Ending',
    branches: [
      {
        label: 'Limit approaching',
        nodes: [
          { subject: 'Your free stories are almost up', delay: '-3d', enabled: true, color: 'amber' },
          { subject: "You've used your free stories", delay: '+0d', enabled: true, color: 'amber' },
        ],
      },
    ],
  },
]

const borderColor: Record<JourneyNode['color'], string> = {
  green: 'border-l-green-500',
  amber: 'border-l-amber-500',
  blue: 'border-l-blue-500',
}

const dotColor: Record<JourneyNode['color'], string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
}

export default function JourneyFlowchart() {
  return (
    <div className="overflow-y-auto max-h-[calc(100vh-6rem)] pr-1">
      <h2 className="text-sm font-semibold text-white mb-6 tracking-wide">
        Customer Journey
      </h2>

      <div className="space-y-8">
        {journey.map((phase) => (
          <div key={phase.title}>
            {/* Phase header (diamond-ish label) */}
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rotate-45 bg-brand-400 inline-block shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-400">
                {phase.title}
              </span>
            </div>

            {/* Vertical trunk line + branches */}
            <div className="relative ml-[3px] border-l border-adm-border pl-5 space-y-5">
              {phase.branches.map((branch) => (
                <div key={branch.label}>
                  {/* Branch decision label */}
                  <div className="relative -ml-5 flex items-center gap-2 mb-2">
                    {/* Horizontal connector tick */}
                    <span className="w-4 h-px bg-adm-border inline-block" />
                    <span className="text-[11px] font-medium text-adm-muted bg-adm-surface border border-adm-border rounded-full px-2.5 py-0.5 whitespace-nowrap">
                      {branch.label}
                    </span>
                  </div>

                  {/* Nodes */}
                  <div className="space-y-1.5 ml-1">
                    {branch.nodes.map((node, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        {/* Connecting line segment */}
                        <div className="flex flex-col items-center pt-1.5 shrink-0">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              node.enabled ? dotColor[node.color] : 'bg-gray-600'
                            }`}
                          />
                          {idx < branch.nodes.length - 1 && (
                            <div className="w-px h-full min-h-[24px] bg-gray-700 mt-0.5" />
                          )}
                        </div>

                        {/* Card */}
                        <div
                          className={`flex-1 bg-adm-surface border border-adm-border ${borderColor[node.color]} border-l-2 rounded-lg px-3 py-2`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-white truncate leading-snug">
                              {node.subject}
                            </p>
                            <span className="text-[10px] text-adm-subtle font-mono shrink-0">
                              {node.delay}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
