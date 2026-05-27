export namespace model {
	
	export class AIBatchRequest {
	    provider: string;
	    n: number;
	    sourcePaths: string[];
	    outputDir: string;
	    prompt: string;
	    model: string;
	    size: string;
	    quality: string;
	    referenceImages: string[];
	    seed: number;
	    outputFormat: string;
	    watermark: boolean;
	    guidanceScale: number;
	    responseFormat: string;
	    stream: boolean;
	    sequentialImageGeneration: string;
	    maxImages: number;
	    optimizePromptMode: string;
	    webSearch: boolean;
	    concurrent: number;
	    downloadWidth: number;
	
	    static createFrom(source: any = {}) {
	        return new AIBatchRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.n = source["n"];
	        this.sourcePaths = source["sourcePaths"];
	        this.outputDir = source["outputDir"];
	        this.prompt = source["prompt"];
	        this.model = source["model"];
	        this.size = source["size"];
	        this.quality = source["quality"];
	        this.referenceImages = source["referenceImages"];
	        this.seed = source["seed"];
	        this.outputFormat = source["outputFormat"];
	        this.watermark = source["watermark"];
	        this.guidanceScale = source["guidanceScale"];
	        this.responseFormat = source["responseFormat"];
	        this.stream = source["stream"];
	        this.sequentialImageGeneration = source["sequentialImageGeneration"];
	        this.maxImages = source["maxImages"];
	        this.optimizePromptMode = source["optimizePromptMode"];
	        this.webSearch = source["webSearch"];
	        this.concurrent = source["concurrent"];
	        this.downloadWidth = source["downloadWidth"];
	    }
	}
	export class BatchRequest {
	    sourcePaths: string[];
	    outputDir: string;
	    convertTo?: string;
	    resizeMode?: string;
	    resizeValue?: number;
	    resizeWidth?: number;
	    resizeHeight?: number;
	    preserveOriginal: boolean;
	    saveMode?: string;
	    prefixName?: string;
	    subdirName?: string;
	
	    static createFrom(source: any = {}) {
	        return new BatchRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourcePaths = source["sourcePaths"];
	        this.outputDir = source["outputDir"];
	        this.convertTo = source["convertTo"];
	        this.resizeMode = source["resizeMode"];
	        this.resizeValue = source["resizeValue"];
	        this.resizeWidth = source["resizeWidth"];
	        this.resizeHeight = source["resizeHeight"];
	        this.preserveOriginal = source["preserveOriginal"];
	        this.saveMode = source["saveMode"];
	        this.prefixName = source["prefixName"];
	        this.subdirName = source["subdirName"];
	    }
	}
	export class ImageResult {
	    sourcePath: string;
	    outputPath?: string;
	    outputPaths?: string[];
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ImageResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourcePath = source["sourcePath"];
	        this.outputPath = source["outputPath"];
	        this.outputPaths = source["outputPaths"];
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class BatchResult {
	    total: number;
	    success: number;
	    failed: number;
	    results: ImageResult[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new BatchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.success = source["success"];
	        this.failed = source["failed"];
	        this.results = this.convertValues(source["results"], ImageResult);
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ModelCapabilities {
	    supportsImageInput: boolean;
	    supportsEdits: boolean;
	    supportsSequential: boolean;
	    supportsStream: boolean;
	    supportsGuidanceScale: boolean;
	    supportsOutputFormat: boolean;
	    supportsWebSearch: boolean;
	    supportsFastPromptOptimize: boolean;
	    supportsSeed: boolean;
	    supportsWatermark: boolean;
	    supportsN: boolean;
	    defaultOutputFormat: string;
	    allowedSizes: string[];
	    nMax: number;
	
	    static createFrom(source: any = {}) {
	        return new ModelCapabilities(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.supportsImageInput = source["supportsImageInput"];
	        this.supportsEdits = source["supportsEdits"];
	        this.supportsSequential = source["supportsSequential"];
	        this.supportsStream = source["supportsStream"];
	        this.supportsGuidanceScale = source["supportsGuidanceScale"];
	        this.supportsOutputFormat = source["supportsOutputFormat"];
	        this.supportsWebSearch = source["supportsWebSearch"];
	        this.supportsFastPromptOptimize = source["supportsFastPromptOptimize"];
	        this.supportsSeed = source["supportsSeed"];
	        this.supportsWatermark = source["supportsWatermark"];
	        this.supportsN = source["supportsN"];
	        this.defaultOutputFormat = source["defaultOutputFormat"];
	        this.allowedSizes = source["allowedSizes"];
	        this.nMax = source["nMax"];
	    }
	}
	export class ModelInfo {
	    id: string;
	    capabilities: ModelCapabilities;
	
	    static createFrom(source: any = {}) {
	        return new ModelInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.capabilities = this.convertValues(source["capabilities"], ModelCapabilities);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProviderConfigResponse {
	    hasApiKey: boolean;
	    baseURL: string;
	
	    static createFrom(source: any = {}) {
	        return new ProviderConfigResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hasApiKey = source["hasApiKey"];
	        this.baseURL = source["baseURL"];
	    }
	}
	export class SliceRequest {
	    sourcePaths: string[];
	    outputDir: string;
	    sliceMode: string;
	    sliceCount: number;
	    sliceHeight: number;
	    contrast: number;
	    saturation: number;
	    saveMode?: string;
	    prefixName?: string;
	    subdirName?: string;
	
	    static createFrom(source: any = {}) {
	        return new SliceRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourcePaths = source["sourcePaths"];
	        this.outputDir = source["outputDir"];
	        this.sliceMode = source["sliceMode"];
	        this.sliceCount = source["sliceCount"];
	        this.sliceHeight = source["sliceHeight"];
	        this.contrast = source["contrast"];
	        this.saturation = source["saturation"];
	        this.saveMode = source["saveMode"];
	        this.prefixName = source["prefixName"];
	        this.subdirName = source["subdirName"];
	    }
	}
	export class WatermarkPreviewRequest {
	    sourcePath: string;
	    watermarkImage: string;
	    watermarkText: string;
	    opacity: number;
	    position: string;
	    fontSize: number;
	    fontColor: string;
	
	    static createFrom(source: any = {}) {
	        return new WatermarkPreviewRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourcePath = source["sourcePath"];
	        this.watermarkImage = source["watermarkImage"];
	        this.watermarkText = source["watermarkText"];
	        this.opacity = source["opacity"];
	        this.position = source["position"];
	        this.fontSize = source["fontSize"];
	        this.fontColor = source["fontColor"];
	    }
	}
	export class WatermarkRequest {
	    sourcePaths: string[];
	    outputDir: string;
	    watermarkImage: string;
	    watermarkText: string;
	    opacity: number;
	    position: string;
	    fontSize: number;
	    fontColor: string;
	    uniformWidth: number;
	    outputWidth: number;
	    saveMode?: string;
	    prefixName?: string;
	    subdirName?: string;
	
	    static createFrom(source: any = {}) {
	        return new WatermarkRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourcePaths = source["sourcePaths"];
	        this.outputDir = source["outputDir"];
	        this.watermarkImage = source["watermarkImage"];
	        this.watermarkText = source["watermarkText"];
	        this.opacity = source["opacity"];
	        this.position = source["position"];
	        this.fontSize = source["fontSize"];
	        this.fontColor = source["fontColor"];
	        this.uniformWidth = source["uniformWidth"];
	        this.outputWidth = source["outputWidth"];
	        this.saveMode = source["saveMode"];
	        this.prefixName = source["prefixName"];
	        this.subdirName = source["subdirName"];
	    }
	}

}

export namespace shell {
	
	export class LaunchIntent {
	    page: string;
	    files: string[];
	
	    static createFrom(source: any = {}) {
	        return new LaunchIntent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.page = source["page"];
	        this.files = source["files"];
	    }
	}

}

