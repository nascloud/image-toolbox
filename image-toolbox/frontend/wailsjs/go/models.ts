export namespace model {
	
	export class BatchRequest {
	    sourcePaths: string[];
	    outputDir: string;
	    convertTo?: string;
	    resizeMode?: string;
	    resizeValue?: number;
	    resizeWidth?: number;
	    resizeHeight?: number;
	    preserveOriginal: boolean;
	
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
	    }
	}
	export class ImageResult {
	    sourcePath: string;
	    outputPath?: string;
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ImageResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourcePath = source["sourcePath"];
	        this.outputPath = source["outputPath"];
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

}

