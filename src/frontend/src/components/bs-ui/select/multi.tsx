import { CheckIcon, Cross1Icon } from "@radix-ui/react-icons"
import React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger } from "."
import { Badge } from "../badge"
import { SearchInput } from "../input"


const MultiItem = ({ active, children, value, onClick}) => {

    return <div key={value}
        className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 mb-1 text-sm outline-none hover:bg-[#EBF0FF] hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 
    ${active && 'bg-[#EBF0FF]'}`}
    onClick={()=>{onClick(value)}}
    >
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
            {active && <CheckIcon className="h-4 w-4"></CheckIcon>}
        </span>
        {children}
    </div>
}


interface IProps {
    options: { label: string, value: string }[],
    defaultValue?: string[],
    children?: React.ReactNode,
    placeholder: string,
    searchPlaceholder?: string,
}
// 临时用 andt 设计方案封装组件
const MultiSelect = ({ defaultValue = [], options = [], children = null, placeholder, searchPlaceholder = '', ...props }: IProps) => {

    const [values, setValues] = React.useState(defaultValue)
    const [optionFilter,setOptionFilter] = React.useState(options)
    // delete
    const handleDelete = (value: string) => {
        const newValues = values.filter((item)=>{
            return item !== value
        })
        setValues(newValues)
    }
    // add
    const handleSwitch = (value: string) => {
        if(values.includes(value)){
            const newValues = values.filter((item)=>{
                return item !== value
            })
            setValues(newValues)
        }else{
            setValues([...values,value])
        }
    }

    // search
    const handleSearch = (e) => {
        const newValues = options.filter((item)=>{
            return item.label.toLowerCase().indexOf(e.target.value.toLowerCase()) !== -1
        })
        setOptionFilter(newValues)
    }

    return <Select {...props} required>
        <SelectTrigger className="mt-2 h-auto">
            {
                values.length
                    ? <div className="flex flex-wrap">
                        {
                            options.filter(option => values.includes(option.value)).map(option =>
                                <Badge  onPointerDown={(e) => e.stopPropagation()}  key={option.value} className="flex items-center gap-1 select-none bg-primary/20 text-primary hover:bg-primary/15 m-[2px]">
                                    {option.label}
                                    <Cross1Icon className="h-3 w-3" onClick={() => handleDelete(option.value)}></Cross1Icon>
                                </Badge>
                            )
                        }
                    </div>
                    : placeholder
            }
        </SelectTrigger>
        <SelectContent>
            <SearchInput inputClassName="h-8" placeholder={searchPlaceholder} onChange={(e)=>{handleSearch(e)}} iconClassName="w-4 h-4" />
            <SelectItem value={"1"} className="hidden"></SelectItem>
            <div className="mt-2">
                {
                    optionFilter.map((item, index) => (
                        <MultiItem active={values.includes(item.value)} value={item.value} onClick={handleSwitch}>{item.label}</MultiItem>
                    ))
                }
            </div>
            {children}
        </SelectContent>
    </Select>
}

MultiSelect.displayName = 'MultiSelect'

export default MultiSelect