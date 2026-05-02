
var user_name:string;
var pass:string;
export const mainRoutes=(req:any,res:any)=>{
    res.send("Welcome");
}

export const register=(req:any,res:any)=>{
    const {username,password}=req.body;
    user_name=username;
    pass=password;
    console.log({user_name,pass});
    res.status(200).json(req.body)
} 

export const login=(req:any,res:any)=>{
    const {username,password}=req.body;
   
    if(user_name=='username' && pass==password){
        console.log("Sucess");
    }else{
        console.log("Failed");
    }
    // console.log({user_name,pass});
    res.status(200).json(req.body)
} 

