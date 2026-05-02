import User from "../models/User";

export const getUserid = (req:any, res:any):void => {
    const { id } = req.params;
    res.send(`Details of user with ID: ${id}`);
}

export const getAllUsers= (req:any,res:any):void=>{
    res.send('List of users');
}

export const createUser =async(req:any,res:any)=>{
    const {name,email,password}=req.body;
    try{
        const newUser = await User.create({name,email,password});
        res.status(201).json(newUser);
    }catch(err){
        res.status(400).json({ message: 'Error creating user', err });
    }
}

export const getAllUser = async (req: any, res: any): Promise<void> => {
    try {
      const users = await User.find();
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  };
  