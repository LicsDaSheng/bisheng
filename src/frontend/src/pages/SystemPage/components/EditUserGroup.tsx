import UsersSelect from "@/components/bs-comp/selectComponent/Users";
import { Button } from "@/components/bs-ui/button";
import { Label } from "@/components/bs-ui/label";
import AutoPagination from "@/components/bs-ui/pagination/autoPagination";
import { RadioGroup, RadioGroupItem } from "@/components/bs-ui/radio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/bs-ui/table";
import { useToast } from "@/components/bs-ui/toast/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/bs-ui/tooltip";
import { locationContext } from "@/contexts/locationContext";
import { getGroupFlowsApi, saveGroupApi } from "@/controllers/API/pro";
import { getAdminsApi, saveUserGroup, updateUserGroup } from "@/controllers/API/user";
import { captureAndAlertRequestErrorHoc } from "@/controllers/request";
import { useTable } from "@/util/hook";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input, SearchInput } from "../../../components/bs-ui/input";

/**
 * 
 * 用户组编辑&创建接口逻辑
 * 创建 
 * 1.用名字和管理员作为参数 调开源接口创建
 * 2.再调闭源接口设置 流控
 * 编辑
 * 1.用名字调开源接口修改
 * 2.用管理员s调开源接口修改
 * 3.再调闭源接口设置 流控
 * 
 * 资源流控控制，每次调接口只传变动的 limit
 * @returns 
 */

function FlowRadio({ limit, onChange }) {
    const { t } = useTranslation()

    return <div>
        <RadioGroup className="flex space-x-2 h-[20px]" value={limit ? 'true' : 'false'}
            onValueChange={(value) => onChange(value === 'false' ? 0 : 10)}>
            <div>
                <Label className="flex justify-center">
                    <RadioGroupItem className="mr-2" value="false" />{t('system.unlimited')}
                </Label>
            </div>
            <div>
                <Label className="flex justify-center">
                    <RadioGroupItem className="mr-2" value="true" />{t('system.limit')}
                </Label>
            </div>
            {limit !== 0 && <div>
                <Label>
                    <p className="mt-[-3px]">
                        {t('system.maximum')}<Input type="number" value={limit} className="inline h-5 w-[70px]"
                            onChange={(e) => onChange(parseFloat(e.target.value))} />{t('system.perMinute')}
                    </p>
                </Label>
            </div>}
        </RadioGroup>
    </div>
}

function FlowControl({ groupId, type, onChange }) {
    const { t } = useTranslation()
    const { name, label, placeholder } = type === 3
        ? { name: t('build.assistantName'), label: t('system.AssistantFlowCtrl'), placeholder: t('system.assistantName') }
        : { name: t('skills.skillName'), label: t('system.SkillFlowCtrl'), placeholder: t('skills.skillName') }
    const { page, pageSize, data, total, setPage, search, refreshData } = useTable({ pageSize: 10 }, (params) =>
        getGroupFlowsApi(params.page, params.pageSize, type, groupId, params.keyword)
    )

    const itemsRef = useRef([])
    const handleChange = (value, id) => {
        // resourceId, groupId, resourceLimit
        const item = itemsRef.current.find(item => item.resource_id === id)
        if (item) {
            item.resource_limit = value
        } else {
            itemsRef.current.push({
                resource_id: id,
                group_id: groupId,
                resource_limit: value
            })
        }
        refreshData((item) => item.id === id, { limit: value })
        onChange(itemsRef.current)
    }

    const handleSearch = (e) => {
        search(e.target.value)
    }

    if (!data.length) return null

    return <>
        <div className="flex items-center mb-4 justify-between">
            <div className="flex items-center space-x-2">
                <p className="text-xl font-bold">{label}</p>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <QuestionMarkCircledIcon />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{t('system.iconHover')}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            <SearchInput placeholder={placeholder} onChange={handleSearch} />
        </div>
        <div className="rounded-[5px]">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{name}</TableHead>
                        <TableHead>{t('system.createdBy')}</TableHead>
                        <TableHead className="flex justify-evenly items-center">{t('system.flowCtrlStrategy')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((i: any) => (<TableRow key={i.id}>
                        <TableCell>{i.name}</TableCell>
                        <TableCell>{i.user_name}</TableCell>
                        <TableCell className="flex justify-evenly items-center pt-[15px]">
                            <FlowRadio limit={i.limit} onChange={(val) => handleChange(val, i.id)}></FlowRadio>
                        </TableCell>
                    </TableRow>))}
                </TableBody>
            </Table>
            <AutoPagination className="m-0 mt-4 w-auto justify-end"
                page={page} pageSize={pageSize} total={total}
                onChange={setPage}
            />
        </div>
    </>
}

export default function EditUserGroup({ data, onBeforeChange, onChange }) {
    const { t } = useTranslation()
    const { toast } = useToast() // 类似于alert
    const { appConfig } = useContext(locationContext)

    const [form, setForm] = useState({
        groupName: '',
        adminUser: '',
        groupLimit: 0,
        assistant: [],
        skill: []
    })
    /**
     * 用户
     */
    const [selected, setSelected] = useState([])
    const [lockOptions, setLockOptions] = useState([])

    const handleSave = async () => {
        if (!form.groupName || form.groupName.length > 30) {
            setForm({ ...form, groupName: data.name || '' })
            return toast({
                title: t('prompt'),
                description: [t('system.groupNameRequired'), t('system.groupNamePrompt')],
                variant: 'error'
            });
        }
        const flag = onBeforeChange(form.groupName)
        if (flag) {
            setForm({ ...form, groupName: '' })
            return toast({ title: t('prompt'), description: t('system.groupNameExists'), variant: 'error' });
        }

        // 过滤系统管理员
        const users = selected.filter(item => !lockOptions.some(id => id === item.value))

        const res = await (data.id ? updateUserGroup(data.id, form, users) : // 修改
            saveUserGroup(form, users)) // 保存

        if (appConfig.isPro) {
            await captureAndAlertRequestErrorHoc(saveGroupApi({
                ...form,
                id: data.id || res.id, // 修改id:data.id， 创建id：res.id
                adminUser: users.map(item => item.label).join(','),
                adminUserId: users.map(item => item.value).join(',')
            }))
        }

        onChange(true)
    }

    useEffect(() => { // 初始化数据
        async function init() {
            setForm({ ...form, groupName: data.group_name, groupLimit: data.group_limit || 0 })
            const res = await getAdminsApi()
            const users = data.group_admins?.map(d => ({ label: d.user_name, value: d.user_id })) || []
            const defaultUsers = res.map(d => ({ label: d.user_name, value: d.user_id }))
            setLockOptions(defaultUsers.map(el => el.value))
            setSelected([...defaultUsers, ...users])
        }
        init()
    }, [])

    return <div className="max-w-[600px] mx-auto pt-4 h-[calc(100vh-136px)] overflow-y-auto pb-10 scrollbar-hide">
        <div className="font-bold mt-4">
            <p className="text-xl mb-4">{t('system.userGroupName')}</p>
            <Input placeholder={t('system.userGroupName')} value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} maxLength={30}></Input>
        </div>
        <div className="font-bold mt-12">
            <p className="text-xl mb-4">{t('system.admins')}</p>
            <div className="">
                <UsersSelect
                    multiple
                    lockedValues={lockOptions}
                    value={selected}
                    onChange={setSelected}
                />
            </div>
        </div>
        {appConfig.isPro && <>
            <div className="font-bold mt-12">
                <p className="text-xl mb-4">{t('system.flowControl')}</p>
                <FlowRadio limit={form.groupLimit} onChange={(f) => setForm({ ...form, groupLimit: f })}></FlowRadio>
            </div>
            <div className="mt-12">
                <FlowControl
                    groupId={data.id}
                    type={3}
                    onChange={(vals) => setForm({ ...form, assistant: vals })}
                ></FlowControl>
            </div>
            <div className="mt-12 mb-20">
                <FlowControl
                    groupId={data.id}
                    type={2}
                    onChange={(vals) => setForm({ ...form, skill: vals })}
                ></FlowControl>
            </div>
        </>}
        <div className="flex justify-center items-center absolute bottom-0 w-[600px] h-[8vh] gap-4 mt-[100px] bg-[white]">
            <Button variant="outline" className="px-16" onClick={onChange}>{t('cancel')}</Button>
            <Button className="px-16" onClick={handleSave}>{t('save')}</Button>
        </div>
    </div>
}