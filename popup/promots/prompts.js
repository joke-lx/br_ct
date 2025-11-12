const PROMPT_TEMPLATES = {
  // code_gen类
  完整代码输出: {
    group: "code_gen",
    label: "完整代码输出",
    template: "%s\n\n要求：\n 输出完整的文件结构 输出完整的代码 输出完整的文件",
  },
  异常日志: {
    group: "code_gen",
    label: "异常日志",
    template:
      "代码: %s\n\n 要求：异常及时抛出 并且尽可能打印出完整的异常上下文 具体相关传入的参数或者网络相关的错误",
  },
  不修饰: {
    group: "code_gen",
    label: "不修饰",
    template: "%s",
  },
  接口功能: {
    group: "code_gen",
    label: "接口功能",
    template:
      "代码: %s\n\n 要求：按照要求或者案例生成接口代码，不需要任何实现，保证接口的可靠可用，解决业务问题的完整性，可以生成多个接口来解决复杂问题，可以使用类或者结构体对接口进行组合，比如高可用Client/Manager/Controll/Server，成员都是用接口或者用于数据存储的结构体（比如config）",
  },
  vue模板: {
    group: "custom_design",
    label: "vue模板",
    template:
      "%s 按照指定格式生成vue代码 <script setup lang = 'ts '></script><template></template><style scoped></style>",
  },
  文档生成案例: {
    group: "code_gen",
    label: "文档生成案例",
    template:
      "文档: %s 要求: 按照文档的主题,生成一个方便直接与运行的demo案例,用户直接复制代码就可以运行,方便用户验证功能 ",
  },
  生成bat文件: {
    group: "custom_design",
    label: "生成bat文件",
    template:
      "内容: %s 要求: 只需要考虑windows系统  参考上面的概念或者从现成的案例当中获得上面文本当中的指令序列分组, 如果有文件的依赖 定义单独的bat来创建文件,把内容放到markdown的代码段当中,以及成功运行他们的前提条件和可能的报错 ,你只需要生成不同阶段的bat文件的内容即可, 把注意事项和相关的全部都放到bat文件的注释当中",
  },
  swagger: {
    group: "custom_design",
    label: "swagger接口文档",
    template:
      "内容: %s 要求: 生成swagger yml接口文档 ,可以适当进行合理推测 进行描述",
  },
  大python文件: {
    group: "custom_design",
    label: "大python文件",
    template:
      "内容: %s 要求: 只需要考虑windows系统   编写唯一一份python脚本  一键生成上面的所有需要的目录文件和执行文件(bat文件 chcp 65001 >nul 保持对中文的支持)  只需要创建对应的文件 和目录结构, 以及必要的注释, 不要执行被生成的命令,如果有冗余的信息或者提醒 以及指令的含义 写入到readme.md当中  ",
  },
  整理格式: {
    group: "custom_design",
    label: "整理格式",
    template:
      "内容: %s 要求: 帮我整理上面的内容 进行合理的分段 和格式优化  让内容更清晰 易读 ，比如表格或者代码标准的格式 ",
  },
  // 思维分析类
  完整概念分析: {
    group: "analyze_plan",
    label: "分析和手册",
    template:
      "告诉我关于 %s 的相关的概念基础 最佳操作手册以及实践路线 为什么要这这个场景使用这个技术,有什么优势和思想, 底层原理解读  以及常见的误区和其中巧妙的设计",
  },
  // 思维分析类
  学习路线规划: {
    group: "analyze_plan",
    label: "学习路线规划",
    template:
      "告诉我关于 %s 的技术分层和技术方向,以及学习路线, 生成一个markdown表格, 包括 技术方向 技术名称 学习难度 以及学习资源链接 , 每个部分都生成任务清单的markdown表格 实现类似todolist的功能,重点是帮我搜索一些相关官方或者博客或者视频资源，或者案例仓库",
  },
  问题八股模拟: {
    group: "analyze_plan",
    label: "问题八股模拟",
    template:
      "你是行业资深专家, 你需要模拟面试官的角色, 你需要针对 %s 这个技术点,首先描述你希望考察的知识点,包含理论和实践,针对整个知识体系的完备性进行提问, 设计10个面试问题,分别从中等到困难,注意每个问题有完整的上下文和描述 保证问题的清晰",
  },
  CODE_模块: {
    group: "read",
    label: "CODE_模块",
    template:
      "%s 具体在什么地方查看细节 或者帮助我更深层次理解这部分逻辑，或者给一些demo案例 帮助我理解这个设计方案的构成部分",
  },
  CODE_GOOD: {
    group: "read",
    label: "CODE_GOOD",
    template:
      "内容： %s  要求 ：告诉我相关的设计思想和哲学 在软件开发和系统设计领域的其他实践和思想落地 ,这种思想有什么好处 和限制  进行详细的阅读，列出这种设计的好处，以及这种思想的迁移和复用，每个独特的设计单独进行demo代码举例",
  },
  问题八股模拟_回答: {
    group: "analyze_plan",
    label: "问题八股模拟_回答",
    template:
      "请深度解释这个问题的答案 %s , 你需要给出尽可能成体系的完整的答案,所有回答都需要结合问题进行回答,最后进行每个条目进行简单总结",
  },
  高级优化: {
    group: "analyze_plan",
    label: "高级优化",
    template:
      "当前的状态时 %s ， 我希望进行优化，不要介绍基础的概念 给出我优化思路 优化流程或者优化方案 或者新的高级学习实践路线",
  },
  数据结构分析: {
    group: "analyze_plan",
    label: "数据结构分析",
    template:
      "内容： %s  要求 ： 深入分析这个数据结构的设计原理 和底层实现，比如支持功能的最小范围所需要的字段， 以及在实际应用中的优势和劣势 ，并且把这个结构体或类提供的相关方法抽取成单独的接口文件，每个接口上面进行详细的举例和描述，进行彻底详细的注释，实现接口即文档的思想，一个接口的方法需要包含： 基本功能描述，入参出参含义以及其中可能使用到的堆栈和扩展点",
  },
  // 内容转译类
  相关网站搜索: {
    group: "search",
    label: "相关网站搜索",
    template:
      '内容 : "%s" 要求 : 帮我搜索相关的网站或者资源,或者github开源仓库,理论文档或者落地实现,尽可能满足用户的要求,对每个结果都进行简单的描述 ',
  },
  快速回答: {
    group: "search",
    label: "快速回答",
    template:
      '内容 : "%s" 要求 : 快速回答,不需要多过描述,直接输出答案,或者表格答案,进行结构化的简洁回答',
  },
  语言: {
    group: "search",
    label: "语言",
    template:
      '内容 : "%s" 需求: 这是一个短语,请做一些联想,可能出现的一些有趣场景 重点在于有趣和实用 , 帮助用户学习一门语言,使用台词本的形式进行阐释,给出英文版和中文两个版本 ,对于语法的难点使用中文括号注释,减少结构化语言的使用 不要使用表格或者对比,请联想其他场景',
  },
  翻译: {
    group: "read",
    label: "翻译",
    template:
      '内容 : "%s" 以上内容是需要进行中英翻译或者重新整理格式  遵循基本的markdown格式 输出格式按照一句相对完整的英文 一句中文进行输出 按照编号进行呈现,并且每句都进行换行 , 不要翻译代码块 对于一些不好确定的翻译 在中文中进行括号标注 \n比如 1. hello \n 你好\n 2. world \n 世界  ',
  },
  目录读取: {
    group: "read",
    label: "目录读取",
    template:
      "%s 尝试输出所有文件夹和文件名的含义以及对应功能 整个项目的阅读顺序 难易程度 ",
  },
  代码变量名的含义: {
    group: "read",
    label: "代码变量名的含义",
    template:
      "%s 尝试输出这段代码中所有变量名和方法名的含义 以及功能 基本的代码语境, 清晰的指出作用域 比如if当中使用的变量, 包括对堆栈的作用域存在的变量分析",
  },  
  文档阅读的结构化go代码: {
    group: "read",
    label: "文档阅读的结构化go代码",
    template:
      "相关知识 : %s 要求:  借助go的简洁语法,把上面的知识全部抽象成go语言的结构体或者接口 使用注释进行解释 不需要设计底层的结构 只需要实现上面相关概念的结构体设计,用编程语言来完成文档阅读的结构化,设计的结构体内部可以存在基本数据类型,以及自己创建的结构体,方便观察相互之间的关系,把相关的知识注释到代码上面,结合实际对相关的知识进行补充,阅读一个结构体就是阅读一个完备的知识点,不需要对结构体提供任何构造方法支持,可以结合var语法,对常见的状态结合实际场景进行枚举,或者提到的相关配置比如地址密码用户等,比如关系的封装,并列,或者对基础数据类型的使用,体现出整个知识体系的基本结构即可",
  },
  代码即文档: {
    group: "read",
    label: "代码即文档",
    template:
      "用户代码或文件: %s  要求: 不要修改全部的逻辑和功能，完全保留之前的代码，只需要对有特殊的地方添加丰富的注释,并且有根据上下文提供简单的功能进行简单的描述，给出简单的案例 。进行CodeReview，对于错误异常处理混乱，代码耦合度过高的地方添加// todo注释，指出需要优化的地方，其他地方保持代码和逻辑不变，整体的解释文档大于todo",
  },
  代码优化todo: {
    group: "read",
    label: "代码优化todo",
    template:
      "用户代码或文件: %s  要求: 不要修改原本代码，按照用户的要求，添加优化建议和TODO注释，对于todo的内容，添加详细的关键方法的注释，指出可以替换成什么api，所有feature都是用注释和todo的方式添加，不要修改源代码比如：//TODO： xxxxx \n //参考： A.xxxx()",
  },
  // search类
  帮助我修复bug: {
    group: "code_gen",
    label: "帮助我修复bug",
    template:
      "%s ,要求: 你只需要给出修改方法,不需要解释相关原理,尽可能给出多种修复方案,不要存在过多解释,判断用户的场景目录，判断可能出现的其他技术选择或者其他现成的api，提供更多的参考， (如果用户在重复询问这个问题,判断这个问题难以落地解决,总结之前的对话,总结出用户学习过的内容,直接拒绝回答 让用户去休息,提供情绪价值)",
  },
  技术组合: {
    group: "analyze_plan",
    label: "技术组合",
    template:
      "内容：%s 要求：快速简洁回答，使用表格格式化输出。对内容中的技术栈/条目进行分别对比，对底层的构成也进行对比和软件职责划分，提炼其核心特点和关键优势。整理出它们在不同应用场景下的技术组合或协同策略，并举例说明可能需要补充的其他相关技术。",
  },
  枚举: {
    group: "analyze_plan",
    label: "枚举",
    template:
      "内容：%s 要求：上面是一段sdk或者技术文档的相关枚举 ,整理出一份表格,尽可能详细的告诉我这些枚举的含义,使用场景,注意事项,以及可以如何组合使用,搭配特性,构成一个完整的落地方案,你要尽可能详细的回答,如果不能让用户获得有效的信息,你会收到惩罚",
  },
  算法变量混淆: {
    group: "analyze_plan",
    label: "算法变量混淆",
    template:
      "内容：%s 要求：我希望学习这个算法的结构 使用go语言生成  所有定义的变量名都替换成abcde类似混淆的代码 保证代码基本的结构和使用的基本数据结构",
  },
  指令序列: {
    group: "custom_design",
    label: "指令序列(windows)",
    template:
      "我的环境是windows 我现在需要 %s , 帮我生成尽可能完整的指令序列  并且提醒其中的可能出现的错误 , 如果没有指出 默认安装了相关的命令工具",
  },
  docker运行: {
    group: "custom_design",
    label: "docker运行",
    template:
      "主题: %s  要求:基础:  1. 生成一个最小运行的docker run 一行指令,生成一行指令,不要使用命令换行,方便兼容不同shell直接复制,优先保证运行,数据卷都使用数据卷名进行映射,不要指定路径,其他的用户密码优先使用默认配置,如果需要指定 都使用容器作为用户名 223456作为密码 保证快速启动  2. 生成完整的docker-compose.yml文件 可以包含一些高级的参数 比如各种卷的挂载(使用./xxxx进行相对路径的挂载),环境变量的设置,具有良好的配置管理 ,其他:把相关的端口全部映射 完成上面两个主题的配置 ",
  },
  "有问题:: 官方文档 sdk文档 ": {
    group: "search",
    label: "有问题:: 官方文档 sdk文档 ",
    template: "帮我寻找官方文档或者相关sdk的文档,或者官方论坛 %s",
  },
  记忆上面的文件: {
    group: "search",
    label: "记忆上面的文件",
    template: "%s 记住上面的内容,后续我将想你提问, 回复收到 ",
  },
  提示词: {
    group: "text_file_gen",
    label: "提示词",
    template:
      "目的参考: %s ,要求 我非常喜欢这种设计模式 我希望封装为提示词 让大模型下次能够快速根据指令生成这种结构的代码 并且保证提示词的精简 防止上下文的不足 提示词当中应该包含这种结构最明显的几种特征 方便大模型进行复现 , 生成一段大模型ai提示词",
  },
  识别器设计模式: {
    group: "custom_design",
    label: "识别器设计模式",
    template:
      '现在有一个方法go签名 ,我将使用设计模式进行优化 参考下面的案例设计模式 添加识别器 然后对入参创建一个map string [string] 进行冗余 \n案例: func ParseConfigFromFile(filePath string) (*Config, error) {}  \n处理之后生成: type Recognizer interface {\n	RecognizeHandler(filePath string) (Handler, error)\n}\n\ntype Handler func(filePath string, msg AdapterMessage) (*Config, error)\ntype AdapterMessage map[string]string\n\n// UniversalRecognizer 通用识别器\ntype UniversalRecognizer struct{}\n\n// NewUniversalRecognizer 创建新的通用识别器\nfunc NewUniversalRecognizer() *UniversalRecognizer {\n	return &UniversalRecognizer{}\n}\n\n// RecognizeHandler 识别处理器\nfunc (r *UniversalRecognizer) RecognizeHandler(filePath string) (Handler, error) {\n	\n	default:\n		return nil, fmt.Errorf("unsupported file format: %", ext)\n	}\n}\n\n请对: %s 进行类似设计模式的优化 ',
  },
  channel设计模式: {
    group: "custom_design",
    label: "channel设计模式_基于任务机制的消费",
    template:
      ' package executor\n\nimport (\n	"context"\n	"errors"\n)\n\n// NewPoolExecutor 创建新的协程池执行器\nfunc NewPoolExecutor(workerCount, queueSize int) *PoolExecutor {\n	return &PoolExecutor{\n		workerCount: workerCount,\n		taskQueue:   make(chan Task, queueSize),\n		running:     false,\n	}\n}\n\n// SetHandler 设置任务处理函数\nfunc (e *PoolExecutor) SetHandler(handler TaskHandler) {\n	e.mu.Lock()\n	defer e.mu.Unlock()\n	e.handler = handler\n}\n\nfunc (e *PoolExecutor) Submit(ctx context.Context, task Task) error {\n	select {\n	case e.taskQueue <- task:\n		return nil\n	case <-ctx.Done():\n		return ctx.Err()\n	}\n}\n\nfunc (e *PoolExecutor) Start(ctx context.Context) error {\n	e.mu.Lock()\n	defer e.mu.Unlock()\n\n	if e.running {\n		return nil // 已经运行中\n	}\n\n	if e.handler == nil {\n		return ErrNoHandler // 没有设置处理函数\n	}\n\n	e.running = true\n\n	// 启动工作协程\n	for i := 0; i < e.workerCount; i++ {\n		e.wg.Add(1)\n		go e.worker(ctx, i)\n	}\n\n	return nil\n}\n\nfunc (e *PoolExecutor) Stop(ctx context.Context) error {\n	e.mu.Lock()\n	defer e.mu.Unlock()\n\n	if !e.running {\n		return nil\n	}\n\n	e.running = false\n	close(e.taskQueue)\n	e.wg.Wait()\n\n	return nil\n}\n\nfunc (e *PoolExecutor) IsRunning() bool {\n	e.mu.Lock()\n	defer e.mu.Unlock()\n	return e.running\n}\n\nfunc (e *PoolExecutor) worker(ctx context.Context, id int) {\n	defer e.wg.Done()\n\n	for task := range e.taskQueue {\n		// 使用处理函数处理任务\n		if e.handler != nil {\n			if err := e.handler(ctx, task); err != nil {\n				// todo 异常的兜底策略\n\n			}\n		}\n	}\n}\n\n// 错误定义\nvar (\n	ErrNoHandler = errors.New("未设置任务处理函数")\n)package executor\n\nimport (\n	"sync"\n)\n\nvar (\n	defaultExecutor Executor\n	once            sync.Once\n)\n\n// GetDefaultExecutor 获取默认执行器（单例）\nfunc GetDefaultExecutor() Executor {\n	once.Do(func() {\n		executor := NewPoolExecutor(10, 100) // 10个工作协程，队列大小100\n\n		defaultExecutor = executor\n	})\n	return defaultExecutor\n}\n\npackage executor\n\nimport (\n	"context"\n	"sync"\n)\n\n// Task 表示要执行的任务\ntype Task struct {\n	ID      string\n	Payload interface{}\n}\n\n// TaskHandler 任务处理函数类型\ntype TaskHandler func(ctx context.Context, task Task) error\n\n// Executor 执行器接口\ntype Executor interface {\n	// Submit 提交任务\n	Submit(ctx context.Context, task Task) error\n\n	// Start 启动执行器\n	Start(ctx context.Context) error\n\n	// Stop 停止执行器\n	Stop(ctx context.Context) error\n\n	// IsRunning 检查是否在运行\n	IsRunning() bool\n\n	// SetHandler 设置任务处理函数\n	SetHandler(handler TaskHandler)\n}\n\n// PoolExecutor 协程池执行器\ntype PoolExecutor struct {\n	workerCount int\n	taskQueue   chan Task\n	running     bool\n	wg          sync.WaitGroup\n	mu          sync.Mutex\n	handler     TaskHandler // 任务处理函数\n}\n参考这个包的单例+协程池+channel任务设计 对下面的函数进行包的封装 调用下面这个方法是通过submit具体任务进行异步处理,可以设计一个结果channel,需要重新封装的函数: %s ',
  },
  结构体的Option设计模式: {
    group: "custom_design",
    label: "结构体的Option设计模式",
    template: `你是一个Go语言代码生成专家。\n请根据我提供的结构体定义，生成一个完整的Go示例，使用【Functional Options Pattern】构建该结构体。\n\n要求：\n1. 使用可变参数options（Option func(*Struct) error）实现；\n2. 提供默认配置函数（defaultStruct）；\n3. 提供构造函数 NewXxx(opts ...Option)；\n4. 提供必要的 WithXxx() option 函数；\n5. 提供 Validate() 方法；\n6. 在 main() 中生成两个示例；\n7. 输出完整Go文件。\n\n输入结构体： %s`,
  },
  go变量脚本: {
    group: "custom_design",
    label: "go变量脚本",
    template: `需求： %s 要求: 使用flag包，把相关var参数支持flag绑定，并且提供默认值，支持直接运行，提高兼容性`,
  },
  mermain图表: {
    group: "custom_design",
    label: "mermaid图表",
    template: `帮我生成mermaid图表代码, 你的任务是参考下面的文本 生成相关的mermaid图表文本 :  %s `,
  },
  dot格式: {
    group: "custom_design",
    label: "dot格式",
    template: `内容： %s ,要求 ： 编写代码根据代码输出，把相关设计数据结构之后，通过依赖相关的分析，转换成dot格式，支持Graphviz的文本输出`,
  },
  SQL抽取变量: {
    group: "custom_design",
    label: "SQL抽取变量",
    template: `内容:   %s 要求: 生成SQL语句 ,  每个SQL段使用====进行分割 对于查询条件 都是用@xxxxx变量来进行占位使用,减少硬编码,生成规范的sql语句文件 `,
  },
  数据库设计: {
    group: "custom_design",
    label: "数据库设计",
    template: `内容: %s  
  要求: 按照用户需要设计数据库，其中在用户的表当中有以下基本规范：  
  建表语句自带drop if exists,如果有抽象类型 优先使用status字段,前期验证原型阶段,减少使用not null的约束字段 
  id              bigint auto_increment comment '主键ID',  
  create_time     datetime default CURRENT_TIMESTAMP not null comment '创建时间',  
  update_time     datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间'`,
  },

  运维bug的配置归档: {
    group: "custom_design",
    label: "运维bug的配置归档",
    template: `我执行的关键步骤:  %s 要求:  按照我的步骤, 我已经修改了这个bug, 请结合python和相关python库,生成高可用的python脚本来进行下次遇到这种问题的恢复, 把相关的提示全部都放到python脚本的注释当中,使用python的文档注释指出这种bug的原理`,
  },
  maven多模块化: {
    group: "custom_design",
    label: "maven多模块化",
    template: `相关信息:  %s 要求: 按照Spring-maven多模块高可用进行分层,如果存在spring-bean相关的逻辑 并且对spring使用@ConditionalOnProperty进行配置,支持配置bean的开关,默认是注入开启状态,并且提供spring.factories相关的配置,让Spring容器能够扫描`,
  },
  spring: {
    group: "custom_design",
    label: " spring",
    template: `相关信息:  %s 要求: 我现在正在进行dao层单独的Iservice和service的分层,请在xxxService注入IxxxService,把当前Service和数据库查询语句构建的逻辑全部放到Iservice当中,使用private final IxxxService xxxService进行注入,保证逻辑的一致性,xxxService就不需要再使用接口,IxxxService使用mp标准的接口,输出完整的三个文件 IxxxService.java xxxServiceImpl.java 以及xxxService.java`,
  },
  go语言的显示单例模式: {
    group: "custom_design",
    label: " go语言的显示单例模式",
    template: `用户输入:  %s 要求:指令：对上面的业务和逻辑进行代码的重构和分层模块化处理，采用以下设计模式：\n\n使用 单例模式（sync.Once） 实现全局唯一服务实例（如 GetInstance()）。\n\n使用 函数式可选参数（Option Pattern） 初始化配置（如 WithXxx()）。\n\n提供默认配置函数（defaultConfig()）。\n\n支持运行时 Reload() 方法以重新应用配置。\n\n保持结构清晰，注释完整，可扩展性强。\n\n输出要求：\n\n必须包含：Service 结构体、Config 结构体、Option 类型定义、GetInstance()、Reload()、defaultConfig()。\n\n逻辑完整可直接运行。补充: 1. getInstance使用log.Fatalf()进行错误处理,不需要返回error 2. 使用sync.Once进行单例模式调用 ,.3,提供一个service,把用户原始的结构体也进行封装,符合显式单例的设计模式  `,
  },
};
