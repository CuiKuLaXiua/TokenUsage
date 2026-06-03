# 靠边吸附交互流程图

## 状态转换图

```mermaid
stateDiagram-v2
    [*] --> 无状态: 窗口创建
    无状态 --> 靠边隐藏中: 拖拽到边缘(< 20px)
    靠边隐藏中 --> 已弹出: 鼠标移入边缘(< 5px)
    已弹出 --> 靠边隐藏中: 鼠标移出窗口(> 50px)
    已弹出 --> 自由状态: 拖拽 > 200px
    自由状态 --> 靠边隐藏中: 拖拽到新边缘(< 20px)
    自由状态 --> [*]: 窗口关闭
    靠边隐藏中 --> [*]: 窗口关闭

    state 靠边隐藏中 {
      [*] --> 隐藏动画中
      隐藏动画中 --> 等待鼠标: 动画完成(200ms)
      等待鼠标 --> 隐藏动画中: 继续轮询(200ms)
    }

    state 已弹出 {
      [*] --> 显示动画中
      显示动画中 --> 等待移出: 动画完成(200ms)
      等待移出 --> 显示动画中: 继续轮询(200ms)
    }
```

## 拖拽交互流程

```mermaid
flowchart TD
    A[用户开始拖拽] --> B{移动距离 > 3px?}
    B -->|否| A
    B -->|是| C[启动 IPC 拖拽]

    C --> D[window-drag-move]
    D --> E{移动距离 > 200px?}
    E -->|是| F[清除 edgeDockState]
    E -->|否| G[保持 edgeDockState]
    F --> H[更新窗口位置]
    G --> H

    H --> I[用户释放鼠标]
    I --> J{窗口在 edgeDockState 中?}

    J -->|是| K[不进行边缘检测]
    J -->|否| L{checkEdgeDocking}

    L -->|距离边缘 < 20px| M[保存 edgeDockState]
    L -->|距离边缘 >= 20px| N[结束]

    M --> O[动画移动到靠边位置]
    O --> P[启动鼠标轮询]

    K --> N
    N --> [*]

    style K fill:#90EE90
    style M fill:#FFE4B5
```

## 鼠标轮询流程

```mermaid
flowchart TD
    A[轮询开始] --> B{floatWindow 存在?}
    B -->|否| C[停止轮询]
    B -->|是| D{edgeDockState 存在?}

    D -->|否| C
    D -->|是| E[获取鼠标位置]

    E --> F{state.isDocked?}

    F -->|true| G{鼠标在边缘附近?<br/>(< 5px)}
    F -->|false| H{鼠标远离窗口?<br/>(> 50px)}

    G -->|是| I[动画弹出到原始位置]
    G -->|否| J[继续轮询]

    H -->|是| K[动画收起到靠边位置]
    H -->|否| J

    I --> L[更新 state.isDocked = false]
    K --> M[更新 state.isDocked = true]

    L --> J
    M --> J

    J --> A

    style G fill:#90EE90
    style H fill:#FFE4B5
```

## 边界检查流程

```mermaid
flowchart TD
    A[计算新位置 newX, newY] --> B[获取显示器工作区]

    B --> C{newX < workX?}
    C -->|是| D[newX = workX]
    C -->|否| E{newX > workX + workW - winW?}

    D --> E
    E -->|是| F[newX = workX + workW - winW]
    E -->|否| G{newY < workY?}

    F --> G
    G -->|是| H[newY = workY]
    G -->|否| I{newY > workY + workH - winH?}

    H --> I
    I -->|是| J[newY = workY + workH - winH]
    I -->|否| K[应用新位置]

    J --> K
    K --> L[setPosition newX, newY]

    style D fill:#FFB6C1
    style F fill:#FFB6C1
    style H fill:#FFB6C1
    style J fill:#FFB6C1
```

## 时序图：首次吸附

```mermaid
sequenceDiagram
    participant U as 用户
    participant R as 渲染进程
    participant M as 主进程

    U->>R: mousedown
    R->>R: onWindowDragStart()
    R->>M: start-window-drag

    U->>R: mousemove
    R->>M: window-drag-move
    M->>M: 边界检查
    M->>M: setPosition()

    U->>R: mouseup
    R->>M: stop-window-drag

    M->>M: 窗口不在 edgeDockState 中
    M->>M: checkEdgeDocking()
    M->>M: 距离左侧 15px < 20px

    M->>M: 保存 edgeDockState
    M->>M: animateWindowPosition(dockX, dockY)
    M->>M: startHoverPolling()

    Note over M: 窗口隐藏到边缘
```

## 时序图：拖拽弹出的窗口

```mermaid
sequenceDiagram
    participant U as 用户
    participant R as 渲染进程
    participant M as 主进程

    Note over M: 当前状态：isDocked: false

    U->>R: mousedown
    R->>M: start-window-drag

    U->>R: mousemove (移动 100px)
    R->>M: window-drag-move
    M->>M: 拖拽距离 100px < 200px
    M->>M: 不清除 edgeDockState
    M->>M: setPosition()

    U->>R: mouseup
    R->>M: stop-window-drag

    M->>M: 窗口在 edgeDockState 中
    M->>M: 不进行边缘检测

    Note over M: 窗口在新位置自由移动
    Note over M: 继续轮询检测鼠标移出
```

## 时序图：重新吸附到新边缘

```mermaid
sequenceDiagram
    participant U as 用户
    participant R as 渲染进程
    participant M as 主进程

    Note over M: 当前状态：左侧吸附

    U->>R: mousedown
    R->>M: start-window-drag

    U->>R: mousemove (移动 250px)
    R->>M: window-drag-move
    M->>M: 拖拽距离 250px > 200px
    M->>M: 清除 edgeDockState
    M->>M: stopHoverPolling()
    M->>M: setPosition()

    U->>R: 拖拽到右侧边缘
    R->>M: window-drag-move
    M->>M: setPosition()

    U->>R: mouseup
    R->>M: stop-window-drag

    M->>M: 窗口不在 edgeDockState 中
    M->>M: checkEdgeDocking()
    M->>M: 距离右侧 10px < 20px

    M->>M: 保存新的 edgeDockState
    M->>M: animateWindowPosition(dockX, dockY)
    M->>M: startHoverPolling()

    Note over M: 窗口隐藏到右侧边缘
```

## 阈值示意图

```
屏幕宽度: 1920px
工作区: 1920px - 任务栏高度

左侧边缘:
  0px                    20px         工作区宽度
  |                       |            |
  |  窗口左边缘检测区域  |            |
  |<---- EDGE_THRESHOLD --->|
  |                       |            |

鼠标移入检测:
  窗口右边缘    5px内触发弹出
  |             |
  |<----------->|

鼠标移出检测:
  窗口右边缘              50px外触发收起
  |                       |
  |<--------------------->|

拖拽清除阈值:
  起始位置                       200px
  |                              |
  |<--------------------------->|
```

## 关键参数

| 参数 | 值 | 单位 | 说明 |
|------|-----|------|------|
| `EDGE_THRESHOLD` | 20 | px | 触发吸附的距离阈值 |
| `EDGE_REVEAL_ZONE` | 5 | px | 触发弹出的距离阈值 |
| `EDGE_HIDE_ZONE` | 50 | px | 触发收起的距离阈值 |
| `CLEAR_DOCK_THRESHOLD` | 200 | px | 清除吸附状态的拖拽距离 |
| `DRAG_THRESHOLD` | 3 | px | 启动拖拽的最小移动距离 |
| 动画时长 | 200 | ms | 弹出/收起动画的持续时间 |
| 轮询间隔 | 200 | ms | 鼠标位置检测的间隔 |
